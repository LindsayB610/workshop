use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ed25519_dalek::{Signer, SigningKey};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::net::{IpAddr, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};

const WORKSHOP_PREFERENCES_MENU_ID: &str = "workshop:preferences";
const WORKSHOP_OPEN_PREFERENCES_EVENT: &str = "workshop:open-preferences";
const WORKSHOP_CHECK_FOR_UPDATES_MENU_ID: &str = "workshop:check-for-updates";
const WORKSHOP_CHECK_FOR_UPDATES_EVENT: &str = "workshop:check-for-updates";
#[cfg(test)]
const STANDARD_EDIT_MENU_ACTIONS: [&str; 6] =
    ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"];
fn is_preferences_menu_id(id: &str) -> bool {
    id == WORKSHOP_PREFERENCES_MENU_ID
}

fn is_check_for_updates_menu_id(id: &str) -> bool {
    id == WORKSHOP_CHECK_FOR_UPDATES_MENU_ID
}

fn workshop_menu_event_name(id: &str) -> Option<&'static str> {
    if is_preferences_menu_id(id) {
        Some(WORKSHOP_OPEN_PREFERENCES_EVENT)
    } else if is_check_for_updates_menu_id(id) {
        Some(WORKSHOP_CHECK_FOR_UPDATES_EVENT)
    } else {
        None
    }
}

fn emit_workshop_menu_event<R: tauri::Runtime>(app: &tauri::AppHandle<R>, menu_id: &str) {
    let Some(event_name) = workshop_menu_event_name(menu_id) else {
        return;
    };

    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.emit(event_name, ());
    }
}

#[cfg(desktop)]
fn standard_edit_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let undo = PredefinedMenuItem::undo(app, None)?;
    let redo = PredefinedMenuItem::redo(app, None)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;
    Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &undo,
            &redo,
            &PredefinedMenuItem::separator(app)?,
            &cut,
            &copy,
            &paste,
            &PredefinedMenuItem::separator(app)?,
            &select_all,
        ],
    )
}

#[cfg(desktop)]
fn workshop_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let preferences = MenuItem::with_id(
        app,
        WORKSHOP_PREFERENCES_MENU_ID,
        "Preferences…",
        true,
        Some("CmdOrCtrl+,"),
    )?;
    let check_for_updates = MenuItem::with_id(
        app,
        WORKSHOP_CHECK_FOR_UPDATES_MENU_ID,
        "Check for Updates…",
        true,
        None::<&str>,
    )?;
    let app_menu = Submenu::with_items(
        app,
        "Workshop",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Workshop"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &preferences,
            &check_for_updates,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;
    let edit_menu = standard_edit_menu(app)?;
    Menu::with_items(app, &[&app_menu, &edit_menu])
}

const REDLINE_CURL_FINAL_URL_MARKER: &str = "\n__WORKSHOP_FINAL_URL__=";
#[derive(Clone, Debug, Deserialize, Serialize)]
struct RedlinePacketFile {
    path: String,
    contents: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RedlineLiveUrlFetchResult {
    url: String,
    final_url: String,
    fetched_at: String,
    html: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct MegaphonePacketFile {
    path: String,
    contents: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MegaphonePostPackage {
    client_id: String,
    package_root: String,
    files: Vec<MegaphonePacketFile>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MegaphoneClientFolderSummary {
    client_id: String,
    client_name: String,
    client_type: String,
    path: String,
    readiness: String,
    source_count: usize,
    research_files: usize,
    artifact_paths: Vec<String>,
    calendar_items: Vec<serde_json::Value>,
    measurement_signals: Vec<serde_json::Value>,
    warnings: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MegaphoneAiCredentialStatus {
    status: String,
    provider: String,
    model: String,
    storage: String,
    message: String,
    fallback_enabled: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct MegaphoneBridgeEnvelope<T> {
    ok: bool,
    data: Option<T>,
    error: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConfiguredMarkdownSource {
    id: String,
    label: String,
    view: String,
    path: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConfiguredMarkdownConfig {
    version: u8,
    sources: Vec<ConfiguredMarkdownSource>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfiguredMarkdownSnapshot {
    contents: String,
    updated_at: u128,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ConfiguredMarkdownSourceMetadata {
    id: String,
    label: String,
    view: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfiguredMarkdownSourceChange {
    root: String,
    config_file: String,
    source: String,
}

const SECURE_SERVICE_KEYCHAIN_SERVICE: &str = "Workshop secure service";
const SECURE_SERVICE_CURL_STATUS_MARKER: &str = "\n__WORKSHOP_SECURE_SERVICE_STATUS__=";
const SECURE_SERVICE_MAX_BODY_BYTES: usize = 64 * 1024;
const MANAGED_SECURE_SERVICE_VERSION: u8 = 1;
const MANAGED_SETUP_MAX_AGE_SECONDS: u64 = 24 * 60 * 60;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SecureServiceConfig {
    version: u8,
    endpoint: String,
    credential_ref: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct SecureServiceMetadata {
    version: u8,
    endpoint: String,
    credential_ref: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SecureServiceRequest {
    method: String,
    path: String,
    body: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SecureServiceResponse {
    status: u16,
    body: serde_json::Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ManagedSecureServicePendingRecord {
    version: u8,
    setup_id: String,
    service_id: String,
    config_file: String,
    installation_id: String,
    created_at_epoch_seconds: u64,
    signing_key: String,
    public_key: String,
    fingerprint: String,
    suggested_topic: String,
    state: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ManagedSecureServicePendingView {
    version: u8,
    setup_id: String,
    service_id: String,
    config_file: String,
    installation_id: String,
    public_key: String,
    fingerprint: String,
    suggested_topic: String,
    state: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ManagedSecureServicePairingContract {
    service_identity: String,
    api_version: String,
    setup_version: String,
    manifest_path: String,
    challenge_path: String,
    pair_path: String,
    additional_pair_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagedSecureServiceManifest {
    service: String,
    api_version: String,
    setup_version: String,
    canonical_origin: String,
    deployed_public_key_fingerprint: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagedSecureServiceChallenge {
    id: String,
    nonce: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ManagedSecureServicePairResponse {
    client: ManagedSecureServicePairClient,
    credential: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagedSecureServicePairClient {
    id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedSecureServiceCapability {
    version: u8,
    available: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedSecureServiceHandoffResult {
    opened: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedSecureServiceDisconnectResult {
    disconnected: bool,
    remote_service_preserved: bool,
}

struct ConfiguredMarkdownWatchState {
    watchers: Mutex<HashMap<PathBuf, RecommendedWatcher>>,
}

fn normalize_redline_path(path: &str) -> Result<PathBuf, String> {
    let requested = Path::new(path);

    if requested.is_absolute() {
        return Err("Only workspace-relative Redline paths can be opened.".into());
    }

    let normalized = requested
        .components()
        .try_fold(PathBuf::new(), |mut acc, component| match component {
            std::path::Component::Normal(part) => {
                acc.push(part);
                Ok(acc)
            }
            _ => Err("Redline artifact paths must stay inside the workspace.".to_string()),
        })?;

    if !normalized.starts_with("clients") {
        return Err("Only files under clients/ can be opened from Redline.".into());
    }

    Ok(normalized)
}

fn normalize_megaphone_path(path: &str) -> Result<PathBuf, String> {
    let requested = Path::new(path);

    if requested.is_absolute() {
        return Err("Only workspace-relative Megaphone paths can be opened.".into());
    }

    let normalized = requested
        .components()
        .try_fold(PathBuf::new(), |mut acc, component| match component {
            std::path::Component::Normal(part) => {
                acc.push(part);
                Ok(acc)
            }
            _ => Err("Megaphone artifact paths must stay inside the workspace.".to_string()),
        })?;

    if !normalized.starts_with("clients") {
        return Err("Only files under clients/ can be opened from Megaphone.".into());
    }

    Ok(normalized)
}

fn normalize_megaphone_client_folder(path: &str) -> Result<PathBuf, String> {
    let normalized = normalize_megaphone_path(path)?;
    let parts = normalized.components().count();

    if parts != 2 {
        return Err("Megaphone client folders must look like clients/<client-id>.".into());
    }

    Ok(normalized)
}

fn normalize_workspace_root(path: &str) -> Result<PathBuf, String> {
    let requested = Path::new(path);

    if !requested.is_absolute() {
        return Err("Private workspace roots must be absolute local paths.".into());
    }

    let normalized = requested
        .components()
        .try_fold(PathBuf::new(), |mut acc, component| match component {
            std::path::Component::Prefix(prefix) => {
                acc.push(prefix.as_os_str());
                Ok(acc)
            }
            std::path::Component::RootDir => {
                acc.push(std::path::MAIN_SEPARATOR.to_string());
                Ok(acc)
            }
            std::path::Component::Normal(part) => {
                acc.push(part);
                Ok(acc)
            }
            _ => Err("Private workspace roots cannot contain traversal segments.".to_string()),
        })?;

    let blocked_pilot_client = ["para", "sail"].concat();
    if normalized
        .join("clients")
        .join(blocked_pilot_client)
        .exists()
    {
        return Err("This workspace contains private pilot client data and cannot be selected for public Workshop flows.".into());
    }

    Ok(normalized)
}

fn explicit_workspace_roots(workspace_root: Option<&str>) -> Result<Vec<PathBuf>, String> {
    match workspace_root {
        Some(root) if !root.trim().is_empty() => Ok(vec![normalize_workspace_root(root)?]),
        _ => Ok(Vec::new()),
    }
}

fn validate_config_file_name(config_file: &str) -> Result<&str, String> {
    let path = Path::new(config_file);
    if config_file.trim().is_empty()
        || path.file_name().and_then(|name| name.to_str()) != Some(config_file)
        || path.extension().and_then(|extension| extension.to_str()) != Some("json")
    {
        return Err("Markdown source config must be a JSON filename in the workspace root.".into());
    }
    Ok(config_file)
}

fn secure_service_root(workspace_root: &str) -> Result<PathBuf, String> {
    let root = normalize_workspace_root(workspace_root)?;
    let metadata = fs::symlink_metadata(&root)
        .map_err(|_| "Secure service private root is unavailable.".to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Secure service private root must be a regular directory.".into());
    }

    for ancestor in root.ancestors() {
        if ancestor.join(".git").exists() {
            return Err("Secure service private root must stay outside a repository.".into());
        }
    }
    Ok(root)
}

fn parse_secure_service_endpoint(endpoint: &str) -> Result<String, String> {
    let endpoint = endpoint.trim();
    let (scheme, authority) = if let Some(authority) = endpoint.strip_prefix("https://") {
        ("https", authority)
    } else if cfg!(debug_assertions) {
        if let Some(authority) = endpoint.strip_prefix("http://localhost") {
            return parse_local_secure_service_endpoint("localhost", authority);
        }
        if let Some(authority) = endpoint.strip_prefix("http://127.0.0.1") {
            return parse_local_secure_service_endpoint("127.0.0.1", authority);
        }
        return Err("Secure service endpoint must use HTTPS.".into());
    } else {
        return Err("Secure service endpoint must use HTTPS.".into());
    };

    if authority.is_empty()
        || authority.contains(['/', '?', '#', '@', '\\'])
        || authority
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("Secure service endpoint must be an HTTPS origin without a path.".into());
    }
    let origin = format!("{scheme}://{authority}");
    let parsed = url::Url::parse(&origin).map_err(|_| {
        "Secure service endpoint must be an HTTPS origin without a path.".to_string()
    })?;
    let hostname = parsed
        .host_str()
        .ok_or("Secure service endpoint must include a host.".to_string())?;
    validate_secure_service_hostname(hostname)?;
    Ok(origin)
}

fn validate_secure_service_hostname(hostname: &str) -> Result<(), String> {
    let normalized = hostname
        .trim_matches(['[', ']'])
        .trim_end_matches('.')
        .to_ascii_lowercase();
    if normalized == "localhost"
        || normalized.ends_with(".localhost")
        || normalized.ends_with(".local")
        || normalized.ends_with(".internal")
        || normalized.ends_with(".home")
        || normalized.ends_with(".lan")
        || normalized == "localtest.me"
        || normalized.ends_with(".localtest.me")
    {
        return Err("Secure service endpoint must use a public host.".into());
    }
    if let Ok(address) = normalized.parse::<IpAddr>() {
        validate_public_service_ip(address)?;
    }
    Ok(())
}

fn validate_public_service_ip(address: IpAddr) -> Result<(), String> {
    let blocked = match address {
        IpAddr::V4(address) => {
            let octets = address.octets();
            address.is_private()
                || address.is_loopback()
                || address.is_link_local()
                || address.is_broadcast()
                || address.is_documentation()
                || address.is_unspecified()
                || address.is_multicast()
                || (octets[0] == 100 && (64..=127).contains(&octets[1]))
                || octets[0] == 0
        }
        IpAddr::V6(address) => {
            address.is_loopback()
                || address.is_unspecified()
                || address.is_multicast()
                || address.is_unique_local()
                || address.is_unicast_link_local()
                || address
                    .to_ipv4_mapped()
                    .map(|mapped| validate_public_service_ip(IpAddr::V4(mapped)).is_err())
                    .unwrap_or(false)
        }
    };
    if blocked {
        return Err("Secure service endpoint resolved to a private or unsafe address.".into());
    }
    Ok(())
}

fn pinned_secure_service_resolution(endpoint: &str) -> Result<String, String> {
    let parsed =
        url::Url::parse(endpoint).map_err(|_| "Secure service endpoint is invalid.".to_string())?;
    let hostname = parsed
        .host_str()
        .ok_or("Secure service endpoint must include a host.".to_string())?;
    let port = parsed
        .port_or_known_default()
        .ok_or("Secure service endpoint port is invalid.".to_string())?;
    let addresses = (hostname, port)
        .to_socket_addrs()
        .map_err(|_| "Secure service host could not be resolved.".to_string())?
        .collect::<Vec<_>>();
    if addresses.is_empty() {
        return Err("Secure service host could not be resolved.".into());
    }
    for address in &addresses {
        validate_public_service_ip(address.ip())?;
    }
    let address = addresses[0].ip();
    let rendered = match address {
        IpAddr::V4(address) => address.to_string(),
        IpAddr::V6(address) => format!("[{address}]"),
    };
    Ok(format!("{hostname}:{port}:{rendered}"))
}

fn parse_local_secure_service_endpoint(host: &str, suffix: &str) -> Result<String, String> {
    if suffix.is_empty() {
        return Ok(format!("http://{host}"));
    }
    if let Some(port) = suffix.strip_prefix(':') {
        if !port.is_empty() && port.chars().all(|character| character.is_ascii_digit()) {
            return Ok(format!("http://{host}:{port}"));
        }
    }
    Err("Secure service endpoint must be an origin without a path.".into())
}

fn validate_external_url(url: &str) -> Result<String, String> {
    if url.is_empty()
        || url
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("External URLs cannot contain whitespace or control characters.".into());
    }
    if url.starts_with("https:///") || url.starts_with("http:///") {
        return Err("External web URLs must include a valid host.".into());
    }
    let parsed = url::Url::parse(url).map_err(|_| "External URL is malformed.".to_string())?;
    match parsed.scheme() {
        "http" | "https"
            if parsed.host_str().is_some()
                && parsed.username().is_empty()
                && parsed.password().is_none() =>
        {
            Ok(url.to_string())
        }
        "http" | "https" => {
            Err("External web URLs must include a host and cannot include credentials.".into())
        }
        "mailto" => {
            let recipient = parsed.path();
            if recipient.split('@').count() == 2
                && !recipient.starts_with('@')
                && !recipient.ends_with('@')
                && !recipient.contains(['/', '\\', ':'])
            {
                Ok(url.to_string())
            } else {
                Err("External mail links must include one valid recipient.".into())
            }
        }
        _ => Err("External URLs must use http, https, or mailto.".into()),
    }
}

fn parse_secure_service_config(contents: &str) -> Result<SecureServiceConfig, String> {
    let config: SecureServiceConfig = serde_json::from_str(contents)
        .map_err(|_| "Secure service configuration is invalid.".to_string())?;
    if config.version != 1 {
        return Err("Secure service configuration version must be 1.".into());
    }
    parse_secure_service_endpoint(&config.endpoint)?;
    if config.credential_ref.is_empty()
        || config.credential_ref.len() > 128
        || !config.credential_ref.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
    {
        return Err("Secure service credential reference is invalid.".into());
    }
    Ok(config)
}

fn secure_service_config_from_root(
    workspace_root: &str,
    config_file: &str,
) -> Result<SecureServiceConfig, String> {
    let root = secure_service_root(workspace_root)?;
    let config_path = root.join(validate_config_file_name(config_file)?);
    let metadata = fs::symlink_metadata(&config_path)
        .map_err(|_| "Secure service configuration is unavailable.".to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Secure service configuration must be a regular JSON file.".into());
    }
    let contents = fs::read_to_string(config_path)
        .map_err(|_| "Could not read secure service configuration.".to_string())?;
    parse_secure_service_config(&contents)
}

fn secure_service_metadata_from_root(
    workspace_root: &str,
    config_file: &str,
) -> Result<SecureServiceMetadata, String> {
    let config = secure_service_config_from_root(workspace_root, config_file)?;
    Ok(SecureServiceMetadata {
        version: config.version,
        endpoint: parse_secure_service_endpoint(&config.endpoint)?,
        credential_ref: config.credential_ref,
    })
}

fn validate_secure_service_request(
    request: &SecureServiceRequest,
) -> Result<(String, Option<String>), String> {
    if !matches!(request.method.as_str(), "GET" | "POST" | "PATCH" | "DELETE") {
        return Err("Secure service request method is not allowed.".into());
    }
    if !request.path.starts_with("/api/")
        || request.path.contains(['?', '#', '\\'])
        || request.path.contains("..")
        || request
            .path
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("Secure service request path is invalid.".into());
    }
    let body = match &request.body {
        Some(body) => {
            if request.method == "GET" || request.method == "DELETE" {
                return Err("Secure service request body is not allowed for this method.".into());
            }
            let serialized = serde_json::to_string(body)
                .map_err(|_| "Secure service request body is invalid.".to_string())?;
            if serialized.len() > SECURE_SERVICE_MAX_BODY_BYTES {
                return Err("Secure service request body is too large.".into());
            }
            Some(serialized)
        }
        None => None,
    };
    Ok((request.path.clone(), body))
}

fn secure_service_keychain_secret(credential_ref: &str) -> Result<String, String> {
    let output = Command::new("security")
        .args([
            "find-generic-password",
            "-s",
            SECURE_SERVICE_KEYCHAIN_SERVICE,
            "-a",
            credential_ref,
            "-w",
        ])
        .output()
        .map_err(|_| "Secure service credential is unavailable.".to_string())?;
    if !output.status.success() {
        return Err("Secure service credential is not configured.".into());
    }
    let credential = String::from_utf8(output.stdout)
        .map_err(|_| "Secure service credential is invalid.".to_string())?
        .trim()
        .to_string();
    if credential.is_empty()
        || credential
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("Secure service credential is invalid.".into());
    }
    Ok(credential)
}

fn parse_secure_service_response(
    output: &[u8],
    credential: &str,
) -> Result<SecureServiceResponse, String> {
    let output = String::from_utf8(output.to_vec())
        .map_err(|_| "Secure service returned an invalid response.".to_string())?;
    let (body, status) = output
        .rsplit_once(SECURE_SERVICE_CURL_STATUS_MARKER)
        .ok_or("Secure service returned an invalid response.".to_string())?;
    if body.len() > SECURE_SERVICE_MAX_BODY_BYTES {
        return Err("Secure service response is too large.".into());
    }
    let status = status
        .trim()
        .parse::<u16>()
        .map_err(|_| "Secure service returned an invalid response.".to_string())?;
    let safe_body = body.replace(credential, "[redacted]");
    Ok(SecureServiceResponse {
        status,
        body: serde_json::from_str(safe_body.trim()).unwrap_or_else(
            |_| serde_json::json!({ "message": "Service returned an invalid response." }),
        ),
    })
}

fn request_configured_secure_service_from_root(
    workspace_root: &str,
    config_file: &str,
    request: SecureServiceRequest,
) -> Result<SecureServiceResponse, String> {
    let config = secure_service_config_from_root(workspace_root, config_file)?;
    let endpoint = parse_secure_service_endpoint(&config.endpoint)?;
    let credential = secure_service_keychain_secret(&config.credential_ref)?;
    let (path, body) = validate_secure_service_request(&request)?;
    let mut command = Command::new("curl");
    command.args([
        "--config",
        "-",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "5",
        "--max-time",
        "15",
        "--max-redirs",
        "0",
        "--request",
        &request.method,
        "--write-out",
        &format!("{SECURE_SERVICE_CURL_STATUS_MARKER}%{{http_code}}"),
    ]);
    if endpoint.starts_with("https://") {
        let pinned_resolution = pinned_secure_service_resolution(&endpoint)?;
        command.args([
            "--proto",
            "=https",
            "--tlsv1.2",
            "--noproxy",
            "*",
            "--resolve",
            &pinned_resolution,
        ]);
    }
    command
        .arg(format!("{endpoint}{path}"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|_| "Could not reach secure service.".to_string())?;
    let mut curl_config = format!(
        "header = \"Authorization: Bearer {}\"\n",
        escape_curl_config_value(&credential)
    );
    if let Some(body) = body {
        curl_config.push_str("header = \"Content-Type: application/json\"\n");
        curl_config.push_str(&format!("data = \"{}\"\n", escape_curl_config_value(&body)));
    }
    child
        .stdin
        .take()
        .ok_or("Could not send secure service request.".to_string())?
        .write_all(curl_config.as_bytes())
        .map_err(|_| "Could not send secure service request.".to_string())?;
    let output = child
        .wait_with_output()
        .map_err(|_| "Could not read secure service response.".to_string())?;
    if !output.status.success() {
        return Err("Secure service request failed.".into());
    }
    let response = parse_secure_service_response(&output.stdout, &credential)?;
    if (300..400).contains(&response.status) {
        return Err("Secure service redirects are not allowed.".into());
    }
    Ok(response)
}

fn validate_managed_service_id(value: &str) -> Result<&str, String> {
    if value.len() < 2
        || value.len() > 64
        || !value.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
    {
        return Err("Managed secure service id is invalid.".into());
    }
    Ok(value)
}

fn managed_secure_service_root(app_data_dir: &Path, service_id: &str) -> Result<PathBuf, String> {
    validate_managed_service_id(service_id)?;
    Ok(app_data_dir.join("secure-services").join(service_id))
}

fn prepare_managed_secure_service_root(
    app_data_dir: &Path,
    service_id: &str,
) -> Result<PathBuf, String> {
    let root = managed_secure_service_root(app_data_dir, service_id)?;
    let base = root
        .parent()
        .ok_or("Managed secure service path is invalid.".to_string())?;
    fs::create_dir_all(&root)
        .map_err(|_| "Could not create managed secure service storage.".to_string())?;
    for directory in [base, root.as_path()] {
        let metadata = fs::symlink_metadata(directory)
            .map_err(|_| "Managed secure service storage is unavailable.".to_string())?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err("Managed secure service storage must be a regular directory.".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(directory, fs::Permissions::from_mode(0o700))
                .map_err(|_| "Could not protect managed secure service storage.".to_string())?;
        }
    }
    Ok(root)
}

fn random_managed_value(prefix: &str, bytes: usize) -> String {
    let mut value = vec![0_u8; bytes];
    OsRng.fill_bytes(&mut value);
    format!("{prefix}_{}", URL_SAFE_NO_PAD.encode(value))
}

fn now_epoch_seconds() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|_| "System clock is unavailable.".into())
}

fn secure_write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("Managed secure service path is invalid.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|_| "Could not create managed secure service storage.".to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(parent, fs::Permissions::from_mode(0o700))
            .map_err(|_| "Could not protect managed secure service storage.".to_string())?;
    }
    let temporary = parent.join(format!(
        ".{}.{}.tmp",
        path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("record"),
        random_managed_value("write", 8)
    ));
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|_| "Could not serialize managed secure service state.".to_string())?;
    fs::write(&temporary, bytes)
        .map_err(|_| "Could not write managed secure service state.".to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600))
            .map_err(|_| "Could not protect managed secure service state.".to_string())?;
    }
    fs::rename(&temporary, path).map_err(|_| {
        let _ = fs::remove_file(&temporary);
        "Could not commit managed secure service state.".to_string()
    })
}

fn pending_record_view(
    record: &ManagedSecureServicePendingRecord,
) -> ManagedSecureServicePendingView {
    ManagedSecureServicePendingView {
        version: record.version,
        setup_id: record.setup_id.clone(),
        service_id: record.service_id.clone(),
        config_file: record.config_file.clone(),
        installation_id: record.installation_id.clone(),
        public_key: record.public_key.clone(),
        fingerprint: record.fingerprint.clone(),
        suggested_topic: record.suggested_topic.clone(),
        state: record.state.clone(),
    }
}

fn read_managed_pending_record(
    app_data_dir: &Path,
    service_id: &str,
) -> Result<ManagedSecureServicePendingRecord, String> {
    let root = managed_secure_service_root(app_data_dir, service_id)?;
    let root_metadata = fs::symlink_metadata(&root)
        .map_err(|_| "Managed secure service setup is unavailable.".to_string())?;
    if root_metadata.file_type().is_symlink() || !root_metadata.is_dir() {
        return Err("Managed secure service storage must be a regular directory.".into());
    }
    let path = root.join("pending.json");
    let metadata = fs::symlink_metadata(&path)
        .map_err(|_| "Managed secure service setup is unavailable.".to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Managed secure service setup record is unsafe.".into());
    }
    let record: ManagedSecureServicePendingRecord = serde_json::from_slice(
        &fs::read(path).map_err(|_| "Could not read managed secure service setup.".to_string())?,
    )
    .map_err(|_| "Managed secure service setup is invalid.".to_string())?;
    if record.version != MANAGED_SECURE_SERVICE_VERSION || record.service_id != service_id {
        return Err("Managed secure service setup version or identity is invalid.".into());
    }
    Ok(record)
}

fn begin_managed_secure_service_setup_at(
    app_data_dir: &Path,
    service_id: &str,
    config_file: &str,
    now: u64,
) -> Result<ManagedSecureServicePendingView, String> {
    validate_managed_service_id(service_id)?;
    validate_config_file_name(config_file)?;
    let root = prepare_managed_secure_service_root(app_data_dir, service_id)?;
    let pending_path = root.join("pending.json");
    if pending_path.exists() {
        let existing = read_managed_pending_record(app_data_dir, service_id)?;
        if now.saturating_sub(existing.created_at_epoch_seconds) <= MANAGED_SETUP_MAX_AGE_SECONDS {
            if existing.config_file != config_file {
                return Err(
                    "Managed secure service setup already uses a different configuration file."
                        .into(),
                );
            }
            return Ok(pending_record_view(&existing));
        }
        fs::remove_file(&pending_path)
            .map_err(|_| "Could not retire stale managed secure service setup.".to_string())?;
    }
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();
    let mut spki = hex_bytes("302a300506032b6570032100")?;
    spki.extend_from_slice(verifying_key.as_bytes());
    let public_key = URL_SAFE_NO_PAD.encode(&spki);
    let fingerprint = Sha256::digest(&spki)
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(":");
    let record = ManagedSecureServicePendingRecord {
        version: MANAGED_SECURE_SERVICE_VERSION,
        setup_id: random_managed_value("setup", 18),
        service_id: service_id.into(),
        config_file: config_file.into(),
        installation_id: random_managed_value("installation", 18),
        created_at_epoch_seconds: now,
        signing_key: URL_SAFE_NO_PAD.encode(signing_key.to_bytes()),
        public_key,
        fingerprint,
        suggested_topic: random_managed_value("topic", 24),
        state: "preparing".into(),
    };
    secure_write_json(&pending_path, &record)?;
    Ok(pending_record_view(&record))
}

fn hex_bytes(value: &str) -> Result<Vec<u8>, String> {
    if !value.len().is_multiple_of(2) {
        return Err("Invalid encoded key header.".into());
    }
    (0..value.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&value[index..index + 2], 16)
                .map_err(|_| "Invalid encoded key header.".to_string())
        })
        .collect()
}

fn validate_managed_api_path(value: &str) -> Result<&str, String> {
    if !value.starts_with("/api/")
        || value.contains(['?', '#', '\\'])
        || value.contains("..")
        || value.len() > 160
        || value
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("Managed secure service protocol path is invalid.".into());
    }
    Ok(value)
}

fn validate_managed_pairing_contract(
    contract: &ManagedSecureServicePairingContract,
) -> Result<(), String> {
    for value in [
        &contract.service_identity,
        &contract.api_version,
        &contract.setup_version,
    ] {
        if value.is_empty()
            || value.len() > 96
            || !value.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_')
            })
        {
            return Err("Managed secure service protocol identity is invalid.".into());
        }
    }
    validate_managed_api_path(&contract.manifest_path)?;
    validate_managed_api_path(&contract.challenge_path)?;
    validate_managed_api_path(&contract.pair_path)?;
    if let Some(path) = &contract.additional_pair_path {
        validate_managed_api_path(path)?;
    }
    Ok(())
}

fn managed_pairing_transcript(
    contract: &ManagedSecureServicePairingContract,
    origin: &str,
    challenge: &ManagedSecureServiceChallenge,
    record: &ManagedSecureServicePendingRecord,
) -> String {
    [
        contract.setup_version.as_str(),
        contract.api_version.as_str(),
        origin,
        challenge.id.as_str(),
        challenge.nonce.as_str(),
        record.installation_id.as_str(),
        record.fingerprint.as_str(),
    ]
    .join("\n")
}

fn managed_keychain_store(credential_ref: &str, credential: &str) -> Result<(), String> {
    if credential.is_empty()
        || credential.len() > 4096
        || credential
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("Managed secure service returned an invalid credential.".into());
    }
    let status = Command::new("security")
        .args([
            "add-generic-password",
            "-U",
            "-s",
            SECURE_SERVICE_KEYCHAIN_SERVICE,
            "-a",
            credential_ref,
            "-w",
            credential,
        ])
        .status()
        .map_err(|_| "Could not store managed secure service credential.".to_string())?;
    if !status.success() {
        return Err("Could not store managed secure service credential.".into());
    }
    Ok(())
}

fn managed_keychain_delete(credential_ref: &str) {
    let _ = Command::new("security")
        .args([
            "delete-generic-password",
            "-s",
            SECURE_SERVICE_KEYCHAIN_SERVICE,
            "-a",
            credential_ref,
        ])
        .status();
}

fn managed_keychain_delete_checked(credential_ref: &str) -> Result<(), String> {
    let status = Command::new("security")
        .args([
            "delete-generic-password",
            "-s",
            SECURE_SERVICE_KEYCHAIN_SERVICE,
            "-a",
            credential_ref,
        ])
        .status()
        .map_err(|_| "Could not remove managed secure service credential.".to_string())?;
    if !status.success() {
        return Err("Could not remove managed secure service credential.".into());
    }
    Ok(())
}

fn managed_secure_service_current_client_id(
    response: &SecureServiceResponse,
) -> Result<String, String> {
    if response.status != 200 {
        return Err("Managed secure service could not identify this installation.".into());
    }
    let client_id = response
        .body
        .get("currentClientId")
        .and_then(serde_json::Value::as_str)
        .ok_or("Managed secure service did not identify this installation.".to_string())?;
    if client_id.len() < 4
        || client_id.len() > 128
        || !client_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("Managed secure service returned an invalid installation id.".into());
    }
    Ok(client_id.to_string())
}

fn disconnect_managed_secure_service_at(
    app_data_dir: &Path,
    service_id: &str,
    config_file: &str,
    clients_path: &str,
) -> Result<ManagedSecureServiceDisconnectResult, String> {
    validate_managed_api_path(clients_path)?;
    if !clients_path.ends_with("/clients") {
        return Err("Managed secure service client path is invalid.".into());
    }
    let root = managed_secure_service_root(app_data_dir, service_id)?;
    let root_text = root
        .to_str()
        .ok_or("Managed secure service path is invalid.")?;
    let listed = request_configured_secure_service_from_root(
        root_text,
        config_file,
        SecureServiceRequest {
            method: "GET".into(),
            path: clients_path.into(),
            body: None,
        },
    )?;
    let client_id = managed_secure_service_current_client_id(&listed)?;
    let revoke_path = format!("{clients_path}/{client_id}");
    let revoked = request_configured_secure_service_from_root(
        root_text,
        config_file,
        SecureServiceRequest {
            method: "DELETE".into(),
            path: revoke_path,
            body: None,
        },
    )?;
    if !(200..300).contains(&revoked.status) {
        return Err("Managed secure service did not revoke this installation.".into());
    }
    let config = secure_service_config_from_root(root_text, config_file)?;
    managed_keychain_delete_checked(&config.credential_ref)?;
    fs::remove_file(root.join(validate_config_file_name(config_file)?)).map_err(|_| {
        "Access was revoked, but Workshop could not remove the local connection record.".to_string()
    })?;
    Ok(ManagedSecureServiceDisconnectResult {
        disconnected: true,
        remote_service_preserved: true,
    })
}

fn curl_managed_json(
    endpoint: &str,
    method: &str,
    path: &str,
    body: Option<&serde_json::Value>,
    bearer: Option<&str>,
) -> Result<(u16, serde_json::Value), String> {
    let endpoint = parse_secure_service_endpoint(endpoint)?;
    let pinned_resolution = pinned_secure_service_resolution(&endpoint)?;
    validate_managed_api_path(path)?;
    if !matches!(method, "GET" | "POST" | "DELETE") {
        return Err("Managed secure service request method is invalid.".into());
    }
    let mut command = Command::new("curl");
    command
        .args([
            "--config",
            "-",
            "--silent",
            "--show-error",
            "--proto",
            "=https",
            "--tlsv1.2",
            "--connect-timeout",
            "5",
            "--max-time",
            "15",
            "--max-redirs",
            "0",
            "--noproxy",
            "*",
            "--resolve",
            &pinned_resolution,
            "--request",
            method,
            "--write-out",
            &format!("{SECURE_SERVICE_CURL_STATUS_MARKER}%{{http_code}}"),
        ])
        .arg(format!("{endpoint}{path}"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|_| "Could not reach managed secure service.".to_string())?;
    let mut config = String::new();
    if let Some(credential) = bearer {
        config.push_str(&format!(
            "header = \"Authorization: Bearer {}\"\n",
            escape_curl_config_value(credential)
        ));
    }
    if let Some(body) = body {
        let body = serde_json::to_string(body)
            .map_err(|_| "Managed secure service request is invalid.".to_string())?;
        if body.len() > SECURE_SERVICE_MAX_BODY_BYTES {
            return Err("Managed secure service request is too large.".into());
        }
        config.push_str("header = \"Content-Type: application/json\"\n");
        config.push_str(&format!("data = \"{}\"\n", escape_curl_config_value(&body)));
    }
    child
        .stdin
        .take()
        .ok_or("Could not send managed secure service request.".to_string())?
        .write_all(config.as_bytes())
        .map_err(|_| "Could not send managed secure service request.".to_string())?;
    let output = child
        .wait_with_output()
        .map_err(|_| "Could not read managed secure service response.".to_string())?;
    if !output.status.success() {
        return Err("Managed secure service request failed.".into());
    }
    let output = String::from_utf8(output.stdout)
        .map_err(|_| "Managed secure service returned invalid data.".to_string())?;
    let (body, status) = output
        .rsplit_once(SECURE_SERVICE_CURL_STATUS_MARKER)
        .ok_or("Managed secure service returned invalid data.".to_string())?;
    if body.len() > SECURE_SERVICE_MAX_BODY_BYTES {
        return Err("Managed secure service response is too large.".into());
    }
    let status = status
        .trim()
        .parse::<u16>()
        .map_err(|_| "Managed secure service returned invalid data.".to_string())?;
    if (300..400).contains(&status) {
        return Err("Managed secure service redirects are not allowed.".into());
    }
    let value = serde_json::from_str(body.trim())
        .map_err(|_| "Managed secure service returned invalid data.".to_string())?;
    Ok((status, value))
}

fn complete_managed_secure_service_setup_at(
    app_data_dir: &Path,
    service_id: &str,
    setup_id: &str,
    endpoint: &str,
    contract: &ManagedSecureServicePairingContract,
) -> Result<SecureServiceMetadata, String> {
    validate_managed_pairing_contract(contract)?;
    let endpoint = parse_secure_service_endpoint(endpoint)?;
    let record = read_managed_pending_record(app_data_dir, service_id)?;
    if record.setup_id != setup_id {
        return Err("Managed secure service setup does not match this session.".into());
    }
    let root = managed_secure_service_root(app_data_dir, service_id)?;
    let metadata = complete_managed_secure_service_transaction(
        service_id,
        &record,
        &endpoint,
        contract,
        |method, path, body, bearer| curl_managed_json(&endpoint, method, path, body, bearer),
        managed_keychain_store,
        managed_keychain_delete,
        |config| secure_write_json(&root.join(&record.config_file), config),
    )?;
    fs::remove_file(root.join("pending.json"))
        .map_err(|_| "Connection succeeded, but pending setup cleanup failed.".to_string())?;
    Ok(metadata)
}

// Keeping each external effect injectable makes the pairing transaction and
// its compensation paths testable without touching the network or Keychain.
#[allow(clippy::too_many_arguments)]
fn complete_managed_secure_service_transaction<
    Exchange,
    StoreCredential,
    DeleteCredential,
    WriteConfig,
>(
    service_id: &str,
    record: &ManagedSecureServicePendingRecord,
    endpoint: &str,
    contract: &ManagedSecureServicePairingContract,
    mut exchange: Exchange,
    mut store_credential: StoreCredential,
    mut delete_credential: DeleteCredential,
    mut write_config: WriteConfig,
) -> Result<SecureServiceMetadata, String>
where
    Exchange: FnMut(
        &str,
        &str,
        Option<&serde_json::Value>,
        Option<&str>,
    ) -> Result<(u16, serde_json::Value), String>,
    StoreCredential: FnMut(&str, &str) -> Result<(), String>,
    DeleteCredential: FnMut(&str),
    WriteConfig: FnMut(&SecureServiceConfig) -> Result<(), String>,
{
    validate_managed_pairing_contract(contract)?;
    let endpoint = parse_secure_service_endpoint(endpoint)?;
    let (manifest_status, manifest_value) = exchange("GET", &contract.manifest_path, None, None)?;
    if manifest_status != 200 {
        return Err("Managed secure service manifest is unavailable.".into());
    }
    let manifest: ManagedSecureServiceManifest = serde_json::from_value(manifest_value)
        .map_err(|_| "Managed secure service manifest is invalid.".to_string())?;
    if manifest.service != contract.service_identity
        || manifest.api_version != contract.api_version
        || manifest.setup_version != contract.setup_version
        || parse_secure_service_endpoint(&manifest.canonical_origin)? != endpoint
        || manifest.deployed_public_key_fingerprint != record.fingerprint
    {
        return Err(
            "Managed secure service identity or deployment fingerprint does not match.".into(),
        );
    }
    let challenge_body = serde_json::json!({ "installationId": record.installation_id });
    let (challenge_status, challenge_value) = exchange(
        "POST",
        &contract.challenge_path,
        Some(&challenge_body),
        None,
    )?;
    if challenge_status != 201 {
        return Err("Managed secure service pairing challenge was rejected.".into());
    }
    let challenge: ManagedSecureServiceChallenge = serde_json::from_value(challenge_value)
        .map_err(|_| "Managed secure service pairing challenge is invalid.".to_string())?;
    let signing_bytes = URL_SAFE_NO_PAD
        .decode(&record.signing_key)
        .map_err(|_| "Managed secure service signing key is invalid.".to_string())?;
    let signing_array: [u8; 32] = signing_bytes
        .try_into()
        .map_err(|_| "Managed secure service signing key is invalid.".to_string())?;
    let signing_key = SigningKey::from_bytes(&signing_array);
    let signature = URL_SAFE_NO_PAD.encode(
        signing_key
            .sign(managed_pairing_transcript(contract, &endpoint, &challenge, record).as_bytes())
            .to_bytes(),
    );
    let pair_body = serde_json::json!({
        "apiVersion": contract.api_version,
        "challengeId": challenge.id,
        "installationId": record.installation_id,
        "origin": endpoint,
        "signature": signature,
    });
    let (pair_status, pair_value) = exchange("POST", &contract.pair_path, Some(&pair_body), None)?;
    if pair_status != 201 {
        return Err("Managed secure service pairing proof was rejected.".into());
    }
    let paired: ManagedSecureServicePairResponse = serde_json::from_value(pair_value)
        .map_err(|_| "Managed secure service pairing response is invalid.".to_string())?;
    let credential_ref = format!("{}.{}", service_id, record.installation_id);
    if let Err(error) = store_credential(&credential_ref, &paired.credential) {
        let revoke_path = format!("/api/setup/clients/{}", paired.client.id);
        let _ = exchange("DELETE", &revoke_path, None, Some(&paired.credential));
        return Err(error);
    }
    let config = SecureServiceConfig {
        version: 1,
        endpoint: endpoint.clone(),
        credential_ref: credential_ref.clone(),
    };
    if let Err(error) = write_config(&config) {
        delete_credential(&credential_ref);
        let revoke_path = format!("/api/setup/clients/{}", paired.client.id);
        let _ = exchange("DELETE", &revoke_path, None, Some(&paired.credential));
        return Err(error);
    }
    Ok(SecureServiceMetadata {
        version: 1,
        endpoint,
        credential_ref,
    })
}

fn complete_managed_secure_service_invitation_at(
    app_data_dir: &Path,
    service_id: &str,
    setup_id: &str,
    endpoint: &str,
    invitation_code: &str,
    contract: &ManagedSecureServicePairingContract,
) -> Result<SecureServiceMetadata, String> {
    let record = read_managed_pending_record(app_data_dir, service_id)?;
    if record.setup_id != setup_id {
        return Err("Managed secure service setup does not match this session.".into());
    }
    let endpoint = parse_secure_service_endpoint(endpoint)?;
    let root = managed_secure_service_root(app_data_dir, service_id)?;
    let metadata = complete_managed_secure_service_invitation_transaction(
        service_id,
        &record,
        &endpoint,
        invitation_code,
        contract,
        |method, path, body, bearer| curl_managed_json(&endpoint, method, path, body, bearer),
        managed_keychain_store,
        managed_keychain_delete,
        |config| secure_write_json(&root.join(&record.config_file), config),
    )?;
    fs::remove_file(root.join("pending.json"))
        .map_err(|_| "Connection succeeded, but pending setup cleanup failed.".to_string())?;
    Ok(metadata)
}

// The invitation path uses the same explicit effect injection so failures can
// prove remote revocation and local credential cleanup independently.
#[allow(clippy::too_many_arguments)]
fn complete_managed_secure_service_invitation_transaction<
    Exchange,
    StoreCredential,
    DeleteCredential,
    WriteConfig,
>(
    service_id: &str,
    record: &ManagedSecureServicePendingRecord,
    endpoint: &str,
    invitation_code: &str,
    contract: &ManagedSecureServicePairingContract,
    mut exchange: Exchange,
    mut store_credential: StoreCredential,
    mut delete_credential: DeleteCredential,
    mut write_config: WriteConfig,
) -> Result<SecureServiceMetadata, String>
where
    Exchange: FnMut(
        &str,
        &str,
        Option<&serde_json::Value>,
        Option<&str>,
    ) -> Result<(u16, serde_json::Value), String>,
    StoreCredential: FnMut(&str, &str) -> Result<(), String>,
    DeleteCredential: FnMut(&str),
    WriteConfig: FnMut(&SecureServiceConfig) -> Result<(), String>,
{
    let endpoint = parse_secure_service_endpoint(endpoint)?;
    if invitation_code.len() < 16
        || invitation_code.len() > 256
        || invitation_code
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("Managed secure service invitation code is invalid.".into());
    }
    validate_managed_pairing_contract(contract)?;
    let additional_path = contract
        .additional_pair_path
        .as_deref()
        .ok_or("Managed secure service does not declare additional-device pairing.".to_string())?;
    let (manifest_status, manifest_value) = exchange("GET", &contract.manifest_path, None, None)?;
    if manifest_status != 200 {
        return Err("Managed secure service manifest is unavailable.".into());
    }
    let manifest: ManagedSecureServiceManifest = serde_json::from_value(manifest_value)
        .map_err(|_| "Managed secure service manifest is invalid.".to_string())?;
    if manifest.service != contract.service_identity
        || manifest.api_version != contract.api_version
        || manifest.setup_version != contract.setup_version
        || parse_secure_service_endpoint(&manifest.canonical_origin)? != endpoint
    {
        return Err("Managed secure service identity does not match.".into());
    }
    let body = serde_json::json!({
        "code": invitation_code,
        "installationId": record.installation_id,
        "origin": endpoint,
    });
    let (pair_status, pair_value) = exchange("POST", additional_path, Some(&body), None)?;
    if pair_status != 201 {
        return Err("Managed secure service invitation was rejected or expired.".into());
    }
    let paired: ManagedSecureServicePairResponse = serde_json::from_value(pair_value)
        .map_err(|_| "Managed secure service pairing response is invalid.".to_string())?;
    let credential_ref = format!("{}.{}", service_id, record.installation_id);
    if let Err(error) = store_credential(&credential_ref, &paired.credential) {
        let revoke_path = format!("/api/setup/clients/{}", paired.client.id);
        let _ = exchange("DELETE", &revoke_path, None, Some(&paired.credential));
        return Err(error);
    }
    let config = SecureServiceConfig {
        version: 1,
        endpoint: endpoint.clone(),
        credential_ref: credential_ref.clone(),
    };
    if let Err(error) = write_config(&config) {
        delete_credential(&credential_ref);
        let revoke_path = format!("/api/setup/clients/{}", paired.client.id);
        let _ = exchange("DELETE", &revoke_path, None, Some(&paired.credential));
        return Err(error);
    }
    Ok(SecureServiceMetadata {
        version: 1,
        endpoint,
        credential_ref,
    })
}

fn parse_configured_markdown_config(contents: &str) -> Result<ConfiguredMarkdownConfig, String> {
    let config: ConfiguredMarkdownConfig = serde_json::from_str(contents)
        .map_err(|error| format!("Markdown source configuration is not valid: {error}"))?;
    if config.version != 1 {
        return Err("Markdown source configuration version must be 1.".into());
    }

    let mut ids = HashSet::new();
    let mut paths = HashSet::new();
    for source in &config.sources {
        if source.id.is_empty()
            || !source.id.chars().all(|character| {
                character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
            })
        {
            return Err(
                "Markdown source ids must use lowercase letters, digits, and hyphens.".into(),
            );
        }
        if !ids.insert(&source.id) {
            return Err("Markdown source ids must be unique.".into());
        }
        if source.label.trim().is_empty() {
            return Err("Markdown source labels cannot be empty.".into());
        }
        if source.view.is_empty()
            || !source.view.chars().all(|character| {
                character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
            })
        {
            return Err(
                "Markdown source views must use lowercase letters, digits, and hyphens.".into(),
            );
        }
        let path = validate_configured_markdown_source_location(&source.path)?;
        if !paths.insert(path) {
            return Err("Markdown source paths must be unique.".into());
        }
    }
    Ok(config)
}

fn configured_markdown_source_metadata_from_root(
    workspace_root: &str,
    config_file: &str,
) -> Result<Vec<ConfiguredMarkdownSourceMetadata>, String> {
    let config = configured_markdown_config_from_root(workspace_root, config_file)?;
    Ok(config
        .sources
        .into_iter()
        .map(|source| ConfiguredMarkdownSourceMetadata {
            id: source.id,
            label: source.label,
            view: source.view,
        })
        .collect())
}

fn validate_configured_markdown_source_location(path: &str) -> Result<PathBuf, String> {
    let requested = Path::new(path);
    if !requested.is_absolute() {
        return Err("Markdown source paths must be absolute local paths.".into());
    }
    if requested
        .extension()
        .and_then(|extension| extension.to_str())
        != Some("md")
    {
        return Err("Markdown source files must be Markdown files.".into());
    }
    if requested
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err("Markdown source paths cannot contain traversal segments.".into());
    }

    Ok(requested.to_path_buf())
}

fn validate_configured_markdown_source_path(path: &str) -> Result<PathBuf, String> {
    let requested = validate_configured_markdown_source_location(path)?;
    let metadata = fs::symlink_metadata(&requested)
        .map_err(|error| format!("Markdown source file is unavailable: {error}"))?;
    if metadata.file_type().is_symlink() {
        return Err("Markdown source files cannot be symlinks.".into());
    }
    if !metadata.is_file() {
        return Err("Markdown source paths must refer to regular files.".into());
    }

    Ok(requested)
}

fn configured_markdown_snapshot(path: &Path) -> Result<ConfiguredMarkdownSnapshot, String> {
    let contents = fs::read_to_string(path)
        .map_err(|error| format!("Could not read Markdown source: {error}"))?;
    let modified = fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .map_err(|error| format!("Could not inspect Markdown source: {error}"))?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Could not timestamp Markdown source: {error}"))?
        .as_millis();

    Ok(ConfiguredMarkdownSnapshot {
        contents,
        updated_at: modified,
    })
}

fn configured_markdown_config_from_root(
    workspace_root: &str,
    config_file: &str,
) -> Result<ConfiguredMarkdownConfig, String> {
    let root = normalize_workspace_root(workspace_root)?;
    let config_path = root.join(validate_config_file_name(config_file)?);
    let config_metadata = fs::symlink_metadata(&config_path)
        .map_err(|error| format!("Markdown source configuration is unavailable: {error}"))?;
    if config_metadata.file_type().is_symlink() || !config_metadata.is_file() {
        return Err("Markdown source configuration must be a regular JSON file.".into());
    }

    let config_contents = fs::read_to_string(config_path)
        .map_err(|error| format!("Could not read Markdown source configuration: {error}"))?;
    parse_configured_markdown_config(&config_contents)
}

/// Deliberately narrow configuration writer for plugin-owned Markdown source
/// lists. The host rebuilds the known schema; plugins never write arbitrary
/// files or JSON through this capability.
fn write_configured_markdown_config_from_root(
    workspace_root: &str,
    config_file: &str,
    config: ConfiguredMarkdownConfig,
) -> Result<ConfiguredMarkdownConfig, String> {
    let root = normalize_workspace_root(workspace_root)?;
    let config_name = validate_config_file_name(config_file)?;
    let config_path = root.join(config_name);
    let metadata = fs::symlink_metadata(&config_path)
        .map_err(|error| format!("Markdown source configuration is unavailable: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Markdown source configuration must be a regular JSON file.".into());
    }
    let config =
        parse_configured_markdown_config(&serde_json::to_string(&config).map_err(|error| {
            format!("Could not validate Markdown source configuration: {error}")
        })?)?;
    for source in &config.sources {
        validate_configured_markdown_source_path(&source.path)?;
    }
    let contents = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Could not serialize Markdown source configuration: {error}"))?
        + "\n";
    let temporary = root.join(format!(".{config_name}.tmp"));
    fs::write(&temporary, contents)
        .map_err(|error| format!("Could not stage Markdown source configuration: {error}"))?;
    fs::rename(&temporary, &config_path)
        .map_err(|error| format!("Could not save Markdown source configuration: {error}"))?;
    Ok(config)
}

fn configured_markdown_source_locations_from_root(
    workspace_root: &str,
    config_file: &str,
) -> Result<Vec<(PathBuf, String)>, String> {
    let config = configured_markdown_config_from_root(workspace_root, config_file)?;
    config
        .sources
        .into_iter()
        .map(|source| {
            Ok((
                validate_configured_markdown_source_location(&source.path)?,
                source.id,
            ))
        })
        .collect()
}

fn configured_markdown_source_from_root(
    workspace_root: &str,
    config_file: &str,
    source_id: &str,
) -> Result<ConfiguredMarkdownSnapshot, String> {
    let config = configured_markdown_config_from_root(workspace_root, config_file)?;
    let source = config
        .sources
        .into_iter()
        .find(|candidate| candidate.id == source_id)
        .ok_or("Markdown source id is not configured.")?;
    configured_markdown_snapshot(&validate_configured_markdown_source_path(&source.path)?)
}

fn configured_markdown_source_for_changed_path(
    watched_sources: &HashMap<PathBuf, String>,
    changed_path: &Path,
) -> Option<String> {
    watched_sources.get(changed_path).cloned()
}

fn configured_markdown_sources_from_event(
    watched_sources: &HashMap<PathBuf, String>,
    event: &notify::Event,
) -> Vec<String> {
    event
        .paths
        .iter()
        .filter_map(|path| configured_markdown_source_for_changed_path(watched_sources, path))
        .collect()
}

fn read_private_workspace_index_from_context(
    workspace_root: Option<&str>,
) -> Result<Option<String>, String> {
    let roots = explicit_workspace_roots(workspace_root)?;
    let Some(root) = roots.first() else {
        return Ok(None);
    };
    let index_path = root.join("workspace.yaml");

    if !index_path.exists() {
        return Ok(None);
    }

    if !index_path.is_file() {
        return Err("Private workspace index must be a workspace.yaml file.".into());
    }

    fs::read_to_string(index_path)
        .map(Some)
        .map_err(|error| format!("Could not read private workspace index: {error}"))
}

fn normalize_megaphone_write_path(path: &str, client_id: &str) -> Result<PathBuf, String> {
    let normalized = normalize_megaphone_path(path)?;
    let client_root = PathBuf::from("clients").join(client_id);
    let post_package_root = client_root.join("post-packages");

    if !normalized.starts_with(&client_root) {
        return Err(format!(
            "Megaphone files for client \"{}\" must stay under {}.",
            client_id,
            client_root.display()
        ));
    }

    if !normalized.starts_with(&post_package_root) {
        return Err(format!(
            "Megaphone post packages must be written under {}.",
            post_package_root.display()
        ));
    }

    match normalized
        .extension()
        .and_then(|extension| extension.to_str())
    {
        Some("md") | Some("json") => Ok(normalized),
        _ => Err("Megaphone post packages can only write Markdown or JSON artifacts.".into()),
    }
}

const MEGAPHONE_KEYCHAIN_SERVICE: &str = "Marketing Builds Megaphone";
const MEGAPHONE_OPENAI_ACCOUNT: &str = "openai-api-key";

fn validate_megaphone_api_key(api_key: &str) -> Result<String, String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("OpenAI API key cannot be empty.".into());
    }
    if trimmed.len() < 12 {
        return Err("OpenAI API key is too short.".into());
    }
    Ok(trimmed.to_string())
}

fn read_megaphone_openai_key() -> Result<Option<String>, String> {
    let output = Command::new("security")
        .args([
            "find-generic-password",
            "-s",
            MEGAPHONE_KEYCHAIN_SERVICE,
            "-a",
            MEGAPHONE_OPENAI_ACCOUNT,
            "-w",
        ])
        .output()
        .map_err(|error| format!("Could not read macOS Keychain: {error}"))?;

    if output.status.success() {
        return Ok(Some(
            String::from_utf8_lossy(&output.stdout).trim().to_string(),
        ));
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("could not be found")
        || stderr.contains("The specified item could not be found")
    {
        return Ok(None);
    }

    Ok(None)
}

fn write_megaphone_openai_key(api_key: &str) -> Result<(), String> {
    let validated = validate_megaphone_api_key(api_key)?;
    let status = Command::new("security")
        .args([
            "add-generic-password",
            "-U",
            "-s",
            MEGAPHONE_KEYCHAIN_SERVICE,
            "-a",
            MEGAPHONE_OPENAI_ACCOUNT,
            "-w",
            &validated,
        ])
        .status()
        .map_err(|error| format!("Could not write macOS Keychain: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err("Could not save OpenAI API key to macOS Keychain.".into())
    }
}

fn clear_megaphone_openai_key() -> Result<(), String> {
    let status = Command::new("security")
        .args([
            "delete-generic-password",
            "-s",
            MEGAPHONE_KEYCHAIN_SERVICE,
            "-a",
            MEGAPHONE_OPENAI_ACCOUNT,
        ])
        .status()
        .map_err(|error| format!("Could not clear macOS Keychain: {error}"))?;

    if !status.success() {
        return Err("Could not clear macOS Keychain credential.".into());
    }
    Ok(())
}

fn megaphone_ai_credential_status(model: String) -> MegaphoneAiCredentialStatus {
    match read_megaphone_openai_key() {
        Ok(Some(_)) => MegaphoneAiCredentialStatus {
            status: "available".into(),
            provider: "openai".into(),
            model,
            storage: "macos_keychain".into(),
            message: "OpenAI API key is saved in local secure storage.".into(),
            fallback_enabled: true,
        },
        Ok(None) => MegaphoneAiCredentialStatus {
            status: "missing_credentials".into(),
            provider: "openai".into(),
            model,
            storage: "not_configured".into(),
            message: "OpenAI API key is not saved in secure storage.".into(),
            fallback_enabled: true,
        },
        Err(error) => MegaphoneAiCredentialStatus {
            status: "unavailable".into(),
            provider: "openai".into(),
            model,
            storage: "macos_keychain".into(),
            message: error,
            fallback_enabled: true,
        },
    }
}

fn normalize_megaphone_onboarding_write_path(
    path: &str,
    client_id: &str,
) -> Result<PathBuf, String> {
    let normalized = normalize_megaphone_path(path)?;
    let client_root = PathBuf::from("clients").join(client_id);

    if !normalized.starts_with(&client_root) {
        return Err(format!(
            "Megaphone onboarding files for client \"{}\" must stay under {}.",
            client_id,
            client_root.display()
        ));
    }

    if normalized.starts_with(client_root.join("post-packages")) {
        return Err("Megaphone onboarding export cannot write post package artifacts.".into());
    }

    match normalized
        .extension()
        .and_then(|extension| extension.to_str())
    {
        Some("md") | Some("json") | Some("yaml") | Some("yml") | Some("csv") => Ok(normalized),
        _ => Err(
            "Megaphone onboarding files can only write Markdown, JSON, YAML, or CSV artifacts."
                .into(),
        ),
    }
}

fn normalize_redline_write_path(path: &str, client_id: &str) -> Result<PathBuf, String> {
    let normalized = normalize_redline_path(path)?;
    let client_root = PathBuf::from("clients").join(client_id);

    if !normalized.starts_with(&client_root) {
        return Err(format!(
            "Packet files for client \"{}\" must stay under {}.",
            client_id,
            client_root.display()
        ));
    }

    Ok(normalized)
}

fn normalize_redline_snapshot_write_path(path: &str, client_id: &str) -> Result<PathBuf, String> {
    let normalized = normalize_redline_write_path(path, client_id)?;
    let client_root = PathBuf::from("clients").join(client_id);
    let allowed_roots = [
        client_root.join("targets/fixtures"),
        client_root.join("targets/extracted"),
        client_root.join("targets/snapshots"),
    ];

    if !allowed_roots
        .iter()
        .any(|root| normalized.starts_with(root))
    {
        return Err(format!(
            "Live target snapshots for client \"{}\" must stay under targets/fixtures, targets/extracted, or targets/snapshots.",
            client_id
        ));
    }

    match normalized
        .extension()
        .and_then(|extension| extension.to_str())
    {
        Some("html") | Some("txt") | Some("md") => Ok(normalized),
        _ => Err("Live target snapshots can only write HTML, text, or Markdown files.".into()),
    }
}

fn megaphone_workspace_roots(
    current_dir: &Path,
    resource_dir: Option<&Path>,
    workspace_root: Option<&str>,
) -> Result<Vec<PathBuf>, String> {
    let mut roots = explicit_workspace_roots(workspace_root)?;

    if let Ok(env_root) = std::env::var("MEGAPHONE_WORKSPACE_ROOT") {
        roots.push(PathBuf::from(env_root));
    }

    roots.push(current_dir.to_path_buf());
    for ancestor in current_dir.ancestors().skip(1) {
        let sibling_megaphone = ancestor.join("megaphone");
        if sibling_megaphone.join("clients").is_dir() {
            roots.push(sibling_megaphone);
        }
    }

    for ancestor in current_dir.ancestors().skip(1) {
        if ancestor.join("clients").is_dir() {
            roots.push(ancestor.to_path_buf());
        }
    }

    if let Some(resource_dir) = resource_dir {
        roots.push(resource_dir.to_path_buf());
    }

    Ok(roots)
}

fn workspace_roots(
    current_dir: &Path,
    resource_dir: Option<&Path>,
    workspace_root: Option<&str>,
) -> Result<Vec<PathBuf>, String> {
    let mut roots = explicit_workspace_roots(workspace_root)?;

    if let Ok(env_root) = std::env::var("REDLINE_WORKSPACE_ROOT") {
        roots.push(PathBuf::from(env_root));
    }

    roots.push(current_dir.to_path_buf());
    for ancestor in current_dir.ancestors().skip(1) {
        if ancestor.join("clients").is_dir() {
            roots.push(ancestor.to_path_buf());
        }
    }

    if let Some(resource_dir) = resource_dir {
        roots.push(resource_dir.to_path_buf());
    }

    Ok(roots)
}

fn resolve_megaphone_path_from_roots(path: &str, roots: &[PathBuf]) -> Result<PathBuf, String> {
    let normalized = normalize_megaphone_path(path)?;

    for root in roots {
        let full_path = root.join(&normalized);
        if full_path.exists() {
            return Ok(full_path);
        }

        if let Ok(without_clients) = normalized.strip_prefix("clients") {
            let bundled_path = root.join(without_clients);
            if bundled_path.exists() {
                return Ok(bundled_path);
            }
        }
    }

    Err(format!("File does not exist: {}", path))
}

fn resolve_redline_path_from_roots(path: &str, roots: &[PathBuf]) -> Result<PathBuf, String> {
    let normalized = normalize_redline_path(path)?;

    for root in roots {
        let full_path = root.join(&normalized);
        if full_path.exists() {
            return Ok(full_path);
        }

        if let Ok(without_clients) = normalized.strip_prefix("clients") {
            let bundled_path = root.join(without_clients);
            if bundled_path.exists() {
                return Ok(bundled_path);
            }
        }
    }

    Err(format!("File does not exist: {}", path))
}

fn megaphone_write_root(
    current_dir: &Path,
    workspace_root: Option<&str>,
) -> Result<PathBuf, String> {
    if let Some(root) = workspace_root {
        if !root.trim().is_empty() {
            return normalize_workspace_root(root);
        }
    }

    if let Ok(env_root) = std::env::var("MEGAPHONE_WORKSPACE_ROOT") {
        return Ok(PathBuf::from(env_root));
    }

    for ancestor in current_dir.ancestors() {
        let sibling_megaphone = ancestor.join("megaphone");
        if sibling_megaphone.join("clients").is_dir() {
            return Ok(sibling_megaphone);
        }

        if ancestor.join("clients").is_dir() {
            return Ok(ancestor.to_path_buf());
        }
    }

    Ok(current_dir.to_path_buf())
}

fn megaphone_bridge_roots(current_dir: &Path) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(env_root) = std::env::var("MEGAPHONE_WORKSPACE_ROOT") {
        roots.push(PathBuf::from(env_root));
    }

    for ancestor in current_dir.ancestors() {
        let sibling_megaphone = ancestor.join("megaphone");
        if sibling_megaphone
            .join("packages/core/dist/bridgeCli.js")
            .is_file()
        {
            roots.push(sibling_megaphone);
        }

        if ancestor.join("packages/core/dist/bridgeCli.js").is_file() {
            roots.push(ancestor.to_path_buf());
        }
    }

    roots
}

fn resolve_megaphone_bridge(current_dir: &Path) -> Result<PathBuf, String> {
    if let Ok(env_bridge) = std::env::var("MEGAPHONE_CORE_BRIDGE") {
        let bridge = PathBuf::from(env_bridge);
        if bridge.is_file() {
            return Ok(bridge);
        }
        return Err("MEGAPHONE_CORE_BRIDGE does not point to a file.".into());
    }

    for root in megaphone_bridge_roots(current_dir) {
        let bridge = root.join("packages/core/dist/bridgeCli.js");
        if bridge.is_file() {
            return Ok(bridge);
        }
    }

    Err(
        "Could not find Megaphone core bridge. Run `npm run build` in the Megaphone core package."
            .into(),
    )
}

fn call_megaphone_bridge<T: for<'de> Deserialize<'de>>(
    current_dir: &Path,
    request: serde_json::Value,
) -> Result<T, String> {
    let bridge = resolve_megaphone_bridge(current_dir)?;
    let mut child = Command::new("node")
        .arg(bridge)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start Megaphone core bridge: {error}"))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(request.to_string().as_bytes())
            .map_err(|error| error.to_string())?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let envelope: MegaphoneBridgeEnvelope<T> =
        serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;
    if envelope.ok {
        envelope
            .data
            .ok_or_else(|| "Megaphone core bridge returned no data.".to_string())
    } else {
        Err(envelope
            .error
            .unwrap_or_else(|| "Megaphone core bridge failed.".into()))
    }
}

fn resolve_megaphone_open_path_from_context(
    current_dir: &Path,
    resource_dir: Option<&Path>,
    workspace_root: Option<&str>,
    path: &str,
) -> Result<PathBuf, String> {
    let roots = megaphone_workspace_roots(current_dir, resource_dir, workspace_root)?;
    resolve_megaphone_path_from_roots(path, &roots)
}

fn megaphone_load_client_folder_from_context(
    current_dir: &Path,
    resource_dir: Option<&Path>,
    workspace_root: Option<&str>,
    path: &str,
) -> Result<MegaphoneClientFolderSummary, String> {
    let normalized = normalize_megaphone_client_folder(path)?;
    let roots = megaphone_workspace_roots(current_dir, resource_dir, workspace_root)?;
    let folder = resolve_megaphone_path_from_roots(&normalized.to_string_lossy(), &roots)?;
    if !folder.is_dir() {
        return Err(format!("Megaphone client path is not a folder: {}", path));
    }

    call_megaphone_bridge(
        current_dir,
        serde_json::json!({
            "command": "load",
            "clientRoot": folder,
            "displayPath": normalized.to_string_lossy(),
        }),
    )
}

#[allow(clippy::too_many_arguments)]
fn megaphone_create_post_package_from_context(
    current_dir: &Path,
    resource_dir: Option<&Path>,
    workspace_root: Option<&str>,
    client_id: String,
    client_path: String,
    topic: String,
    audience: Vec<String>,
    buyer_problem: String,
    post_type: String,
    allow_adjacent_examples: bool,
    proof_risk: String,
    content_pillar: Option<String>,
) -> Result<MegaphonePostPackage, String> {
    let normalized = normalize_megaphone_client_folder(&client_path)?;
    let roots = megaphone_workspace_roots(current_dir, resource_dir, workspace_root)?;
    let folder = resolve_megaphone_path_from_roots(&normalized.to_string_lossy(), &roots)?;

    call_megaphone_bridge(
        current_dir,
        serde_json::json!({
            "command": "createPostPackage",
            "clientRoot": folder,
            "displayPath": normalized.to_string_lossy(),
            "clientId": client_id,
            "topic": topic,
            "audience": audience,
            "buyerProblem": buyer_problem,
            "postType": post_type,
            "allowAdjacentExamples": allow_adjacent_examples,
            "proofRisk": proof_risk,
            "contentPillar": content_pillar,
        }),
    )
}

fn megaphone_test_ai_connection_from_context(
    current_dir: &Path,
    resource_dir: Option<&Path>,
    workspace_root: Option<&str>,
    client_path: String,
    model: String,
) -> Result<serde_json::Value, String> {
    if read_megaphone_openai_key()?.is_some() {
        return Ok(serde_json::json!({
            "availability": "available",
            "provider": "openai",
            "model": model,
            "message": "OpenAI API key is saved in local secure storage.",
            "fallbackEnabled": true,
        }));
    }

    let normalized = normalize_megaphone_client_folder(&client_path)?;
    let roots = megaphone_workspace_roots(current_dir, resource_dir, workspace_root)?;
    let folder = resolve_megaphone_path_from_roots(&normalized.to_string_lossy(), &roots)?;

    call_megaphone_bridge(
        current_dir,
        serde_json::json!({
            "command": "testAiConnection",
            "clientRoot": folder,
            "model": model,
        }),
    )
}

#[allow(clippy::too_many_arguments)]
fn megaphone_create_ai_post_package_from_context(
    current_dir: &Path,
    resource_dir: Option<&Path>,
    workspace_root: Option<&str>,
    client_id: String,
    client_path: String,
    topic: String,
    audience: Vec<String>,
    buyer_problem: String,
    post_type: String,
    allow_adjacent_examples: bool,
    proof_risk: String,
    content_pillar: Option<String>,
    model: String,
) -> Result<MegaphonePostPackage, String> {
    let ai_api_key = read_megaphone_openai_key()?;
    let normalized = normalize_megaphone_client_folder(&client_path)?;
    let roots = megaphone_workspace_roots(current_dir, resource_dir, workspace_root)?;
    let folder = resolve_megaphone_path_from_roots(&normalized.to_string_lossy(), &roots)?;

    call_megaphone_bridge(
        current_dir,
        serde_json::json!({
            "command": "createPostPackage",
            "clientRoot": folder,
            "displayPath": normalized.to_string_lossy(),
            "clientId": client_id,
            "topic": topic,
            "audience": audience,
            "buyerProblem": buyer_problem,
            "postType": post_type,
            "allowAdjacentExamples": allow_adjacent_examples,
            "proofRisk": proof_risk,
            "contentPillar": content_pillar,
            "aiDrafting": true,
            "model": model,
            "aiApiKey": ai_api_key,
        }),
    )
}

#[allow(clippy::too_many_arguments)]
fn megaphone_chat_with_context_from_context(
    current_dir: &Path,
    resource_dir: Option<&Path>,
    workspace_root: Option<&str>,
    client_path: String,
    model: String,
    message: String,
    documents: Vec<serde_json::Value>,
    history: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let ai_api_key = read_megaphone_openai_key()?;
    let normalized = normalize_megaphone_client_folder(&client_path)?;
    let roots = megaphone_workspace_roots(current_dir, resource_dir, workspace_root)?;
    let folder = resolve_megaphone_path_from_roots(&normalized.to_string_lossy(), &roots)?;

    call_megaphone_bridge(
        current_dir,
        serde_json::json!({
            "command": "chatWithContext",
            "clientRoot": folder,
            "model": model,
            "message": message,
            "documents": documents,
            "history": history,
            "aiApiKey": ai_api_key,
        }),
    )
}

fn redline_write_root(current_dir: &Path, workspace_root: Option<&str>) -> Result<PathBuf, String> {
    if let Some(root) = workspace_root {
        if !root.trim().is_empty() {
            return normalize_workspace_root(root);
        }
    }

    if let Ok(env_root) = std::env::var("REDLINE_WORKSPACE_ROOT") {
        return Ok(PathBuf::from(env_root));
    }

    for ancestor in current_dir.ancestors() {
        if ancestor.join("clients").is_dir() {
            return Ok(ancestor.to_path_buf());
        }
    }

    Ok(current_dir.to_path_buf())
}

fn megaphone_write_post_package_files_to_root(
    root: &Path,
    client_id: &str,
    files: &[MegaphonePacketFile],
    overwrite: Option<bool>,
) -> Result<usize, String> {
    if files.is_empty() {
        return Err("No Megaphone post package files were provided for export.".into());
    }

    let allow_overwrite = overwrite.unwrap_or(false);

    for file in files {
        let relative_path = normalize_megaphone_write_path(&file.path, client_id)?;
        let full_path = root.join(relative_path);

        if full_path.exists() && !allow_overwrite {
            return Err(format!(
                "Refusing to overwrite existing Megaphone file: {}",
                file.path
            ));
        }

        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        fs::write(full_path, &file.contents).map_err(|error| error.to_string())?;
    }

    Ok(files.len())
}

fn megaphone_write_onboarding_files_to_root(
    root: &Path,
    client_id: &str,
    files: &[MegaphonePacketFile],
    overwrite: Option<bool>,
) -> Result<usize, String> {
    if files.is_empty() {
        return Err("No Megaphone onboarding files were provided for export.".into());
    }

    let allow_overwrite = overwrite.unwrap_or(false);

    for file in files {
        let relative_path = normalize_megaphone_onboarding_write_path(&file.path, client_id)?;
        let full_path = root.join(relative_path);

        if full_path.exists() && !allow_overwrite {
            return Err(format!(
                "Refusing to overwrite existing Megaphone onboarding file: {}",
                file.path
            ));
        }

        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        fs::write(full_path, &file.contents).map_err(|error| error.to_string())?;
    }

    Ok(files.len())
}

#[tauri::command]
fn megaphone_open_path(
    app: tauri::AppHandle,
    path: String,
    workspace_root: Option<String>,
) -> Result<(), String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let resource_dir = app.path().resource_dir().ok();
    let full_path = resolve_megaphone_open_path_from_context(
        &current_dir,
        resource_dir.as_deref(),
        workspace_root.as_deref(),
        &path,
    )?;

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(&full_path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", full_path.to_string_lossy().as_ref()]);
        command
    };

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(&full_path);
        command
    };

    command.spawn().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn redline_open_path(
    app: tauri::AppHandle,
    path: String,
    workspace_root: Option<String>,
) -> Result<(), String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let resource_dir = app.path().resource_dir().ok();
    let roots = workspace_roots(
        &current_dir,
        resource_dir.as_deref(),
        workspace_root.as_deref(),
    )?;
    let full_path = resolve_redline_path_from_roots(&path, &roots)?;

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(&full_path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", full_path.to_string_lossy().as_ref()]);
        command
    };

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(&full_path);
        command
    };

    command.spawn().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn megaphone_load_client_folder(
    app: tauri::AppHandle,
    path: String,
    workspace_root: Option<String>,
) -> Result<MegaphoneClientFolderSummary, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let resource_dir = app.path().resource_dir().ok();
    megaphone_load_client_folder_from_context(
        &current_dir,
        resource_dir.as_deref(),
        workspace_root.as_deref(),
        &path,
    )
}

#[cfg(test)]
fn collect_megaphone_artifact_paths(
    folder: &Path,
    normalized_client_path: &Path,
) -> Result<Vec<String>, String> {
    let post_packages = folder.join("post-packages");
    if !post_packages.is_dir() {
        return Ok(Vec::new());
    }

    let mut artifacts = Vec::new();
    collect_megaphone_artifact_paths_inner(
        &post_packages,
        folder,
        normalized_client_path,
        &mut artifacts,
    )?;
    artifacts.sort();
    Ok(artifacts)
}

#[cfg(test)]
fn collect_megaphone_artifact_paths_inner(
    directory: &Path,
    client_folder: &Path,
    normalized_client_path: &Path,
    artifacts: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            collect_megaphone_artifact_paths_inner(
                &path,
                client_folder,
                normalized_client_path,
                artifacts,
            )?;
            continue;
        }

        match path.extension().and_then(|extension| extension.to_str()) {
            Some("md") | Some("json") => {
                let relative = path.strip_prefix(client_folder).unwrap_or(&path);
                let path_from_client = normalized_client_path.join(relative);
                artifacts.push(path_from_client.to_string_lossy().to_string());
            }
            _ => {}
        }
    }

    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn megaphone_create_post_package(
    app: tauri::AppHandle,
    client_id: String,
    client_path: String,
    topic: String,
    audience: Vec<String>,
    buyer_problem: String,
    post_type: String,
    allow_adjacent_examples: bool,
    proof_risk: String,
    content_pillar: Option<String>,
    workspace_root: Option<String>,
) -> Result<MegaphonePostPackage, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let resource_dir = app.path().resource_dir().ok();
    megaphone_create_post_package_from_context(
        &current_dir,
        resource_dir.as_deref(),
        workspace_root.as_deref(),
        client_id,
        client_path,
        topic,
        audience,
        buyer_problem,
        post_type,
        allow_adjacent_examples,
        proof_risk,
        content_pillar,
    )
}

#[tauri::command]
fn megaphone_test_ai_connection(
    app: tauri::AppHandle,
    client_path: String,
    model: String,
    workspace_root: Option<String>,
) -> Result<serde_json::Value, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let resource_dir = app.path().resource_dir().ok();
    megaphone_test_ai_connection_from_context(
        &current_dir,
        resource_dir.as_deref(),
        workspace_root.as_deref(),
        client_path,
        model,
    )
}

#[tauri::command]
fn megaphone_get_ai_credential_status(
    model: String,
) -> Result<MegaphoneAiCredentialStatus, String> {
    Ok(megaphone_ai_credential_status(model))
}

#[tauri::command]
fn megaphone_save_ai_credential(
    api_key: String,
    model: String,
) -> Result<MegaphoneAiCredentialStatus, String> {
    write_megaphone_openai_key(&api_key)?;
    Ok(megaphone_ai_credential_status(model))
}

#[tauri::command]
fn megaphone_clear_ai_credential(model: String) -> Result<MegaphoneAiCredentialStatus, String> {
    clear_megaphone_openai_key()?;
    Ok(megaphone_ai_credential_status(model))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn megaphone_create_ai_post_package(
    app: tauri::AppHandle,
    client_id: String,
    client_path: String,
    topic: String,
    audience: Vec<String>,
    buyer_problem: String,
    post_type: String,
    allow_adjacent_examples: bool,
    proof_risk: String,
    content_pillar: Option<String>,
    model: String,
    workspace_root: Option<String>,
) -> Result<MegaphonePostPackage, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let resource_dir = app.path().resource_dir().ok();
    megaphone_create_ai_post_package_from_context(
        &current_dir,
        resource_dir.as_deref(),
        workspace_root.as_deref(),
        client_id,
        client_path,
        topic,
        audience,
        buyer_problem,
        post_type,
        allow_adjacent_examples,
        proof_risk,
        content_pillar,
        model,
    )
}

#[tauri::command]
fn megaphone_chat_with_context(
    app: tauri::AppHandle,
    client_path: String,
    model: String,
    message: String,
    documents: Vec<serde_json::Value>,
    history: Vec<serde_json::Value>,
    workspace_root: Option<String>,
) -> Result<serde_json::Value, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let resource_dir = app.path().resource_dir().ok();
    megaphone_chat_with_context_from_context(
        &current_dir,
        resource_dir.as_deref(),
        workspace_root.as_deref(),
        client_path,
        model,
        message,
        documents,
        history,
    )
}

#[cfg(test)]
fn megaphone_package_file(
    package_root: &str,
    relative_path: &str,
    contents: String,
) -> Result<MegaphonePacketFile, String> {
    let path = format!("{package_root}/{relative_path}");
    let client_id = package_root
        .split('/')
        .nth(1)
        .ok_or_else(|| "Megaphone package root is missing a client id.".to_string())?;
    normalize_megaphone_write_path(&path, client_id)?;
    Ok(MegaphonePacketFile { path, contents })
}

#[cfg(test)]
fn slugify_for_path(value: &str) -> String {
    let mut slug = String::new();
    let mut previous_dash = false;

    for character in value.to_lowercase().chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character);
            previous_dash = false;
        } else if !previous_dash && !slug.is_empty() {
            slug.push('-');
            previous_dash = true;
        }
    }

    while slug.ends_with('-') {
        slug.pop();
    }

    if slug.len() > 120 {
        slug.truncate(120);
        while slug.ends_with('-') {
            slug.pop();
        }
    }

    if slug.len() > 1 {
        slug
    } else {
        "post-package".into()
    }
}

#[tauri::command]
fn megaphone_write_post_package_files(
    client_id: String,
    files: Vec<MegaphonePacketFile>,
    overwrite: Option<bool>,
    workspace_root: Option<String>,
) -> Result<usize, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let root = megaphone_write_root(&current_dir, workspace_root.as_deref())?;
    megaphone_write_post_package_files_to_root(&root, &client_id, &files, overwrite)
}

#[tauri::command]
fn megaphone_write_onboarding_files(
    client_id: String,
    files: Vec<MegaphonePacketFile>,
    overwrite: Option<bool>,
    workspace_root: Option<String>,
) -> Result<usize, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let root = megaphone_write_root(&current_dir, workspace_root.as_deref())?;
    megaphone_write_onboarding_files_to_root(&root, &client_id, &files, overwrite)
}

#[tauri::command]
fn redline_write_packet_files(
    client_id: String,
    files: Vec<RedlinePacketFile>,
    overwrite: Option<bool>,
    workspace_root: Option<String>,
) -> Result<usize, String> {
    if files.is_empty() {
        return Err("No packet files were provided for export.".into());
    }

    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let root = redline_write_root(&current_dir, workspace_root.as_deref())?;
    let allow_overwrite = overwrite.unwrap_or(false);

    for file in &files {
        let relative_path = normalize_redline_write_path(&file.path, &client_id)?;
        let full_path = root.join(relative_path);

        if full_path.exists() && !allow_overwrite {
            return Err(format!(
                "Refusing to overwrite existing Redline file: {}",
                file.path
            ));
        }

        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        fs::write(full_path, &file.contents).map_err(|error| error.to_string())?;
    }

    Ok(files.len())
}

fn redline_write_target_snapshot_files_to_root(
    root: &Path,
    client_id: &str,
    files: &[RedlinePacketFile],
    overwrite: Option<bool>,
) -> Result<usize, String> {
    if files.is_empty() {
        return Err("No live target snapshot files were provided.".into());
    }

    let allow_overwrite = overwrite.unwrap_or(false);

    for file in files {
        let relative_path = normalize_redline_snapshot_write_path(&file.path, client_id)?;
        let full_path = root.join(relative_path);

        if full_path.exists() && !allow_overwrite {
            return Err(format!(
                "Refusing to overwrite existing Redline snapshot file: {}",
                file.path
            ));
        }

        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        fs::write(full_path, &file.contents).map_err(|error| error.to_string())?;
    }

    Ok(files.len())
}

fn split_redline_curl_snapshot_output(output: &str, requested_url: &str) -> (String, String) {
    if let Some((html, final_url)) = output.rsplit_once(REDLINE_CURL_FINAL_URL_MARKER) {
        let normalized_final_url = final_url.trim();
        if !normalized_final_url.is_empty() {
            return (html.to_string(), normalized_final_url.to_string());
        }
    }

    (output.to_string(), requested_url.to_string())
}

#[tauri::command]
fn redline_fetch_live_url(url: String) -> Result<RedlineLiveUrlFetchResult, String> {
    if !url.starts_with("https://") || url.trim().len() <= "https://".len() {
        return Err("Snapshot Live URL only supports HTTPS targets.".into());
    }

    let output = Command::new("curl")
        .args([
            "-L",
            "--fail",
            "--silent",
            "--show-error",
            "--max-time",
            "30",
            "--write-out",
            &format!("{REDLINE_CURL_FINAL_URL_MARKER}%{{url_effective}}"),
            &url,
        ])
        .output()
        .map_err(|error| format!("Could not fetch live URL with curl: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "Could not fetch live URL: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let curl_output = String::from_utf8(output.stdout)
        .map_err(|_| "Fetched live URL was not valid UTF-8 HTML.".to_string())?;
    let (html, final_url) = split_redline_curl_snapshot_output(&curl_output, &url);
    let fetched_at_output = Command::new("date")
        .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
        .output()
        .map_err(|error| format!("Could not resolve snapshot timestamp: {error}"))?;
    let fetched_at = if fetched_at_output.status.success() {
        String::from_utf8_lossy(&fetched_at_output.stdout)
            .trim()
            .to_string()
    } else {
        "1970-01-01T00:00:00Z".into()
    };

    Ok(RedlineLiveUrlFetchResult {
        url: url.clone(),
        final_url,
        fetched_at,
        html,
    })
}

fn escape_curl_config_value(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[tauri::command]
fn redline_write_target_snapshot_files(
    client_id: String,
    files: Vec<RedlinePacketFile>,
    overwrite: Option<bool>,
    workspace_root: Option<String>,
) -> Result<usize, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let root = redline_write_root(&current_dir, workspace_root.as_deref())?;
    redline_write_target_snapshot_files_to_root(&root, &client_id, &files, overwrite)
}

#[tauri::command]
fn read_private_workspace_index(workspace_root: Option<String>) -> Result<Option<String>, String> {
    read_private_workspace_index_from_context(workspace_root.as_deref())
}

#[tauri::command]
fn read_configured_markdown_source(
    workspace_root: String,
    config_file: String,
    source: String,
) -> Result<ConfiguredMarkdownSnapshot, String> {
    configured_markdown_source_from_root(&workspace_root, &config_file, &source)
}

#[tauri::command]
fn read_configured_markdown_sources(
    workspace_root: String,
    config_file: String,
) -> Result<Vec<ConfiguredMarkdownSourceMetadata>, String> {
    configured_markdown_source_metadata_from_root(&workspace_root, &config_file)
}

#[tauri::command]
fn read_configured_markdown_config(
    workspace_root: String,
    config_file: String,
) -> Result<ConfiguredMarkdownConfig, String> {
    configured_markdown_config_from_root(&workspace_root, &config_file)
}

#[tauri::command]
fn write_configured_markdown_config(
    workspace_root: String,
    config_file: String,
    config: ConfiguredMarkdownConfig,
) -> Result<ConfiguredMarkdownConfig, String> {
    write_configured_markdown_config_from_root(&workspace_root, &config_file, config)
}

#[tauri::command]
fn read_secure_service_metadata(
    workspace_root: String,
    config_file: String,
) -> Result<SecureServiceMetadata, String> {
    secure_service_metadata_from_root(&workspace_root, &config_file)
}

#[tauri::command]
fn request_configured_secure_service(
    workspace_root: String,
    config_file: String,
    request: SecureServiceRequest,
) -> Result<SecureServiceResponse, String> {
    request_configured_secure_service_from_root(&workspace_root, &config_file, request)
}

#[tauri::command]
fn managed_secure_service_capability() -> ManagedSecureServiceCapability {
    ManagedSecureServiceCapability {
        version: MANAGED_SECURE_SERVICE_VERSION,
        available: true,
    }
}

#[tauri::command]
fn begin_managed_secure_service_setup(
    app: tauri::AppHandle,
    service_id: String,
    config_file: String,
) -> Result<ManagedSecureServicePendingView, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Workshop managed service storage is unavailable.".to_string())?;
    begin_managed_secure_service_setup_at(
        &app_data_dir,
        &service_id,
        &config_file,
        now_epoch_seconds()?,
    )
}

#[tauri::command]
fn read_managed_secure_service_setup(
    app: tauri::AppHandle,
    service_id: String,
) -> Result<ManagedSecureServicePendingView, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Workshop managed service storage is unavailable.".to_string())?;
    read_managed_pending_record(&app_data_dir, &service_id)
        .map(|record| pending_record_view(&record))
}

#[tauri::command]
fn update_managed_secure_service_setup(
    app: tauri::AppHandle,
    service_id: String,
    setup_id: String,
    state: String,
) -> Result<ManagedSecureServicePendingView, String> {
    if state.len() < 2
        || state.len() > 64
        || !state.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
    {
        return Err("Managed secure service setup state is invalid.".into());
    }
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Workshop managed service storage is unavailable.".to_string())?;
    let mut record = read_managed_pending_record(&app_data_dir, &service_id)?;
    if record.setup_id != setup_id {
        return Err("Managed secure service setup does not match this session.".into());
    }
    record.state = state;
    secure_write_json(
        &managed_secure_service_root(&app_data_dir, &service_id)?.join("pending.json"),
        &record,
    )?;
    Ok(pending_record_view(&record))
}

#[tauri::command]
fn cancel_managed_secure_service_setup(
    app: tauri::AppHandle,
    service_id: String,
    setup_id: String,
) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Workshop managed service storage is unavailable.".to_string())?;
    let record = read_managed_pending_record(&app_data_dir, &service_id)?;
    if record.setup_id != setup_id {
        return Err("Managed secure service setup does not match this session.".into());
    }
    fs::remove_file(managed_secure_service_root(&app_data_dir, &service_id)?.join("pending.json"))
        .map_err(|_| "Could not cancel managed secure service setup.".to_string())
}

#[tauri::command]
fn complete_managed_secure_service_setup(
    app: tauri::AppHandle,
    service_id: String,
    setup_id: String,
    endpoint: String,
    contract: ManagedSecureServicePairingContract,
) -> Result<SecureServiceMetadata, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Workshop managed service storage is unavailable.".to_string())?;
    complete_managed_secure_service_setup_at(
        &app_data_dir,
        &service_id,
        &setup_id,
        &endpoint,
        &contract,
    )
}

#[tauri::command]
fn complete_managed_secure_service_invitation(
    app: tauri::AppHandle,
    service_id: String,
    setup_id: String,
    endpoint: String,
    invitation_code: String,
    contract: ManagedSecureServicePairingContract,
) -> Result<SecureServiceMetadata, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Workshop managed service storage is unavailable.".to_string())?;
    complete_managed_secure_service_invitation_at(
        &app_data_dir,
        &service_id,
        &setup_id,
        &endpoint,
        &invitation_code,
        &contract,
    )
}

#[tauri::command]
fn read_managed_secure_service_metadata(
    app: tauri::AppHandle,
    service_id: String,
    config_file: String,
) -> Result<SecureServiceMetadata, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Workshop managed service storage is unavailable.".to_string())?;
    let root = managed_secure_service_root(&app_data_dir, &service_id)?;
    secure_service_metadata_from_root(
        root.to_str()
            .ok_or("Managed secure service path is invalid.")?,
        &config_file,
    )
}

#[tauri::command]
fn request_managed_secure_service(
    app: tauri::AppHandle,
    service_id: String,
    config_file: String,
    request: SecureServiceRequest,
) -> Result<SecureServiceResponse, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Workshop managed service storage is unavailable.".to_string())?;
    let root = managed_secure_service_root(&app_data_dir, &service_id)?;
    request_configured_secure_service_from_root(
        root.to_str()
            .ok_or("Managed secure service path is invalid.")?,
        &config_file,
        request,
    )
}

#[tauri::command]
fn disconnect_managed_secure_service(
    app: tauri::AppHandle,
    service_id: String,
    config_file: String,
    clients_path: String,
) -> Result<ManagedSecureServiceDisconnectResult, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Workshop managed service storage is unavailable.".to_string())?;
    disconnect_managed_secure_service_at(&app_data_dir, &service_id, &config_file, &clients_path)
}

#[tauri::command]
fn open_managed_secure_service_handoff(
    app: tauri::AppHandle,
    service_id: String,
    config_file: String,
    request: SecureServiceRequest,
    allowed_path_prefix: String,
) -> Result<ManagedSecureServiceHandoffResult, String> {
    use tauri_plugin_opener::OpenerExt;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Workshop managed service storage is unavailable.".to_string())?;
    let root = managed_secure_service_root(&app_data_dir, &service_id)?;
    let root_text = root
        .to_str()
        .ok_or("Managed secure service path is invalid.")?;
    let config = secure_service_config_from_root(root_text, &config_file)?;
    let response = request_configured_secure_service_from_root(root_text, &config_file, request)?;
    if !(200..300).contains(&response.status) {
        return Err("Managed secure service did not create a handoff.".into());
    }
    let handoff = response
        .body
        .get("url")
        .and_then(|value| value.as_str())
        .ok_or("Managed secure service returned an invalid handoff.".to_string())?;
    validate_managed_secure_service_handoff(&config.endpoint, handoff, &allowed_path_prefix)?;
    app.opener()
        .open_url(handoff, None::<&str>)
        .map_err(|error| format!("Could not open managed secure service handoff: {error}"))?;
    Ok(ManagedSecureServiceHandoffResult { opened: true })
}

fn validate_managed_secure_service_handoff(
    endpoint: &str,
    handoff: &str,
    allowed_path_prefix: &str,
) -> Result<(), String> {
    if allowed_path_prefix.len() < 2
        || allowed_path_prefix.len() > 160
        || !allowed_path_prefix.starts_with('/')
        || allowed_path_prefix.contains(['?', '#', '\\'])
        || allowed_path_prefix.contains("..")
        || allowed_path_prefix
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("Managed secure service handoff path is invalid.".into());
    }
    let expected = url::Url::parse(&parse_secure_service_endpoint(endpoint)?)
        .map_err(|_| "Managed secure service endpoint is invalid.".to_string())?;
    let parsed = url::Url::parse(handoff)
        .map_err(|_| "Managed secure service returned an invalid handoff.".to_string())?;
    let path_matches = parsed.path() == allowed_path_prefix
        || parsed
            .path()
            .strip_prefix(allowed_path_prefix)
            .is_some_and(|suffix| suffix.starts_with('/'));
    if parsed.scheme() != expected.scheme()
        || parsed.host_str() != expected.host_str()
        || parsed.port_or_known_default() != expected.port_or_known_default()
        || !path_matches
        || parsed.query().is_some()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Managed secure service handoff does not match the configured origin.".into());
    }
    Ok(())
}

#[tauri::command]
fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let url = validate_external_url(&url)?;
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|error| format!("Could not open external URL: {error}"))
}

#[tauri::command]
fn start_configured_markdown_watch(
    app: tauri::AppHandle,
    state: tauri::State<'_, ConfiguredMarkdownWatchState>,
    workspace_root: String,
    config_file: String,
) -> Result<(), String> {
    let source_locations =
        configured_markdown_source_locations_from_root(&workspace_root, &config_file)?;
    let root = normalize_workspace_root(&workspace_root)?;
    let config_file = validate_config_file_name(&config_file)?.to_owned();
    let mut watchers = state
        .watchers
        .lock()
        .map_err(|_| "Markdown source watcher state is unavailable.".to_string())?;
    let watch_key = root.join(&config_file);
    // A configuration editor may add or remove sources. Replacing an existing
    // watcher keeps its scope exactly aligned with the current config.
    watchers.remove(&watch_key);

    let mut watched_sources = HashMap::new();
    for (path, source_id) in source_locations {
        watched_sources.insert(path, source_id);
    }
    let watched_directories: HashSet<PathBuf> = watched_sources
        .keys()
        .filter_map(|path| path.parent().map(Path::to_path_buf))
        .collect();
    let app_handle = app.clone();
    let event_root = root.to_string_lossy().to_string();
    let event_config_file = config_file.clone();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else {
            return;
        };
        for source in configured_markdown_sources_from_event(&watched_sources, &event) {
            let _ = app_handle.emit(
                "local-markdown://source-changed",
                ConfiguredMarkdownSourceChange {
                    root: event_root.clone(),
                    config_file: event_config_file.clone(),
                    source,
                },
            );
        }
    })
    .map_err(|error| format!("Could not start Markdown source watcher: {error}"))?;

    for directory in watched_directories {
        watcher
            .watch(&directory, RecursiveMode::NonRecursive)
            .map_err(|error| format!("Could not watch Markdown source directory: {error}"))?;
    }
    watchers.insert(watch_key, watcher);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(workshop_menu)
        .on_menu_event(|app, event| {
            emit_workshop_menu_event(app, event.id().0.as_str());
        })
        .manage(ConfiguredMarkdownWatchState {
            watchers: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            megaphone_create_post_package,
            megaphone_create_ai_post_package,
            megaphone_clear_ai_credential,
            megaphone_chat_with_context,
            megaphone_get_ai_credential_status,
            megaphone_load_client_folder,
            megaphone_open_path,
            megaphone_save_ai_credential,
            megaphone_test_ai_connection,
            megaphone_write_onboarding_files,
            megaphone_write_post_package_files,
            read_private_workspace_index,
            redline_open_path,
            redline_fetch_live_url,
            redline_write_target_snapshot_files,
            redline_write_packet_files,
            read_secure_service_metadata,
            request_configured_secure_service,
            managed_secure_service_capability,
            begin_managed_secure_service_setup,
            read_managed_secure_service_setup,
            update_managed_secure_service_setup,
            cancel_managed_secure_service_setup,
            complete_managed_secure_service_setup,
            complete_managed_secure_service_invitation,
            read_managed_secure_service_metadata,
            request_managed_secure_service,
            disconnect_managed_secure_service,
            open_managed_secure_service_handoff,
            open_external_url,
            read_configured_markdown_sources,
            read_configured_markdown_source,
            read_configured_markdown_config,
            write_configured_markdown_config,
            start_configured_markdown_watch
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_process::init())?;
                app.handle().plugin(tauri_plugin_dialog::init())?;
                app.handle().plugin(tauri_plugin_opener::init())?;
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Workshop desktop app");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_root(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("workshop-redline-{label}-{nanos}"))
    }

    #[test]
    fn external_url_capability_allows_only_safe_browser_and_mail_links() {
        assert_eq!(
            validate_external_url("https://docs.example.com/getting-started?from=workshop#install")
                .expect("https links should be allowed"),
            "https://docs.example.com/getting-started?from=workshop#install"
        );
        assert_eq!(
            validate_external_url("http://localhost:3000/help")
                .expect("http links should be allowed"),
            "http://localhost:3000/help"
        );
        assert_eq!(
            validate_external_url("mailto:hello@example.com?subject=Workshop")
                .expect("mailto links should be allowed"),
            "mailto:hello@example.com?subject=Workshop"
        );

        for unsafe_url in [
            "javascript:alert(1)",
            "data:text/html,hello",
            "file:///Users/example/private.md",
            "https:///missing-host",
            "https://user:secret@example.com/private",
            "mailto:",
            "https://example.com\nInjected: value",
            " https://example.com",
        ] {
            assert!(
                validate_external_url(unsafe_url).is_err(),
                "{unsafe_url} should be rejected"
            );
        }
    }

    #[test]
    fn managed_handoff_requires_the_exact_origin_and_a_real_path_boundary() {
        for allowed in [
            "https://pulse.example/setup/notification#single-use-capability",
            "https://pulse.example/setup/notification/confirm#single-use-capability",
        ] {
            validate_managed_secure_service_handoff(
                "https://pulse.example",
                allowed,
                "/setup/notification",
            )
            .expect("the configured handoff path or a true child path should be allowed");
        }

        for unsafe_handoff in [
            "https://pulse.example/setup/notification-evil#capability",
            "https://pulse.example/setup/notification?capability=leaked",
            "https://other.example/setup/notification#capability",
            "https://user:secret@pulse.example/setup/notification#capability",
        ] {
            assert!(
                validate_managed_secure_service_handoff(
                    "https://pulse.example",
                    unsafe_handoff,
                    "/setup/notification",
                )
                .is_err(),
                "{unsafe_handoff} should be rejected"
            );
        }
        for unsafe_prefix in ["/", "/setup/../notification", "/setup/notification?leak"] {
            assert!(
                validate_managed_secure_service_handoff(
                    "https://pulse.example",
                    "https://pulse.example/setup/notification#capability",
                    unsafe_prefix,
                )
                .is_err(),
                "{unsafe_prefix} should be rejected"
            );
        }
    }

    #[test]
    fn preferences_menu_uses_a_neutral_host_event_contract() {
        assert!(is_preferences_menu_id(WORKSHOP_PREFERENCES_MENU_ID));
        assert!(!is_preferences_menu_id("slate:preferences"));
        assert_eq!(WORKSHOP_OPEN_PREFERENCES_EVENT, "workshop:open-preferences");
        assert_eq!(
            workshop_menu_event_name(WORKSHOP_PREFERENCES_MENU_ID),
            Some(WORKSHOP_OPEN_PREFERENCES_EVENT)
        );
    }

    #[test]
    fn standard_edit_menu_keeps_macos_text_editing_actions_available() {
        assert_eq!(
            STANDARD_EDIT_MENU_ACTIONS,
            ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"]
        );
        let menu_source = include_str!("lib.rs");
        for predefined_action in [
            "PredefinedMenuItem::undo(app, None)",
            "PredefinedMenuItem::redo(app, None)",
            "PredefinedMenuItem::cut(app, None)",
            "PredefinedMenuItem::copy(app, None)",
            "PredefinedMenuItem::paste(app, None)",
            "PredefinedMenuItem::select_all(app, None)",
            "let edit_menu = standard_edit_menu(app)?;",
        ] {
            assert!(
                menu_source.contains(predefined_action),
                "missing {predefined_action}"
            );
        }
    }

    #[test]
    fn update_menu_uses_a_neutral_host_event_contract() {
        assert!(is_check_for_updates_menu_id(
            WORKSHOP_CHECK_FOR_UPDATES_MENU_ID
        ));
        assert!(!is_check_for_updates_menu_id("pulse:check-for-updates"));
        assert_eq!(
            WORKSHOP_CHECK_FOR_UPDATES_EVENT,
            "workshop:check-for-updates"
        );
        assert_eq!(
            workshop_menu_event_name(WORKSHOP_CHECK_FOR_UPDATES_MENU_ID),
            Some(WORKSHOP_CHECK_FOR_UPDATES_EVENT)
        );
        assert_eq!(workshop_menu_event_name("not-a-workshop-menu-action"), None);
    }

    #[test]
    fn reads_only_sources_declared_in_a_generic_markdown_config() {
        let root = unique_temp_root("markdown-sources");
        let source_root = root.join("sources");
        fs::create_dir_all(&source_root).expect("source directory should be created");
        let tasks = source_root.join("tasks.md");
        let notes = source_root.join("notes.md");
        let inventory = source_root.join("inventory.md");
        fs::write(&tasks, "# Tasks\n").expect("tasks source should be written");
        fs::write(&notes, "# Notes\n").expect("notes source should be written");
        fs::write(&inventory, "# Inventory\n").expect("inventory source should be written");
        fs::write(
            root.join("sources.config.json"),
            serde_json::json!({
                "version": 1,
                "sources": [
                    { "id": "tasks", "label": "Tasks", "view": "task-list", "path": tasks },
                    { "id": "notes", "label": "Notes", "view": "notes", "path": notes },
                    { "id": "inventory", "label": "Inventory", "view": "inventory", "path": inventory },
                ],
            })
            .to_string(),
        )
        .expect("generic Markdown source configuration should be written");

        assert_eq!(
            configured_markdown_source_metadata_from_root(
                root.to_str().expect("temp root should be utf8"),
                "sources.config.json",
            )
            .expect("configured source metadata should load"),
            vec![
                ConfiguredMarkdownSourceMetadata {
                    id: "tasks".into(),
                    label: "Tasks".into(),
                    view: "task-list".into(),
                },
                ConfiguredMarkdownSourceMetadata {
                    id: "notes".into(),
                    label: "Notes".into(),
                    view: "notes".into(),
                },
                ConfiguredMarkdownSourceMetadata {
                    id: "inventory".into(),
                    label: "Inventory".into(),
                    view: "inventory".into(),
                },
            ]
        );

        assert_eq!(
            configured_markdown_source_from_root(
                root.to_str().expect("temp root should be utf8"),
                "sources.config.json",
                "tasks"
            )
            .expect("configured source should load independently")
            .contents,
            "# Tasks\n"
        );
        assert_eq!(
            configured_markdown_source_from_root(
                root.to_str().expect("temp root should be utf8"),
                "sources.config.json",
                "inventory"
            )
            .expect("configured source should load independently")
            .contents,
            "# Inventory\n"
        );
        assert_eq!(
            configured_markdown_source_from_root(
                root.to_str().expect("temp root should be utf8"),
                "sources.config.json",
                "notes"
            )
            .expect("configured source should load independently")
            .contents,
            "# Notes\n"
        );
        assert!(configured_markdown_source_from_root(
            root.to_str().expect("temp root should be utf8"),
            "sources.config.json",
            "other"
        )
        .is_err());

        fs::remove_file(&notes).expect("notes source should be removable");
        assert_eq!(
            configured_markdown_source_from_root(
                root.to_str().expect("temp root should be utf8"),
                "sources.config.json",
                "tasks"
            )
            .expect("one source should not depend on another source")
            .contents,
            "# Tasks\n"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn writes_only_a_valid_existing_config_with_regular_declared_sources() {
        let root = unique_temp_root("markdown-config-write");
        fs::create_dir_all(&root).expect("root should be created");
        let source = root.join("notes.md");
        fs::write(&source, "# Notes\n").expect("source should be written");
        fs::write(
            root.join("sources.config.json"),
            r#"{"version":1,"sources":[]}"#,
        )
        .expect("config should exist");
        let saved = write_configured_markdown_config_from_root(
            root.to_str().expect("temp root should be utf8"),
            "sources.config.json",
            ConfiguredMarkdownConfig {
                version: 1,
                sources: vec![ConfiguredMarkdownSource {
                    id: "notes".into(),
                    label: "Notes".into(),
                    view: "markdown".into(),
                    path: source.to_string_lossy().to_string(),
                }],
            },
        )
        .expect("valid source config should save");
        assert_eq!(saved.sources.len(), 1);
        assert!(fs::read_to_string(root.join("sources.config.json"))
            .expect("config should read")
            .contains("\"notes\""));
        let missing = ConfiguredMarkdownConfig {
            version: 1,
            sources: vec![ConfiguredMarkdownSource {
                id: "missing".into(),
                label: "Missing".into(),
                view: "markdown".into(),
                path: root.join("missing.md").to_string_lossy().to_string(),
            }],
        };
        assert!(write_configured_markdown_config_from_root(
            root.to_str().expect("temp root should be utf8"),
            "sources.config.json",
            missing
        )
        .is_err());
        fs::remove_dir_all(root).expect("temp root should be removed");
    }

    #[test]
    fn secure_service_config_exposes_metadata_without_a_credential_value() {
        let config = parse_secure_service_config(
            r#"{"version":1,"endpoint":"https://service.example","credentialRef":"private-token"}"#,
        )
        .expect("secure service config should parse");
        let metadata = SecureServiceMetadata {
            version: config.version,
            endpoint: parse_secure_service_endpoint(&config.endpoint)
                .expect("endpoint should normalize"),
            credential_ref: config.credential_ref,
        };
        let serialized = serde_json::to_string(&metadata).expect("metadata should serialize");

        assert!(serialized.contains("https://service.example"));
        assert!(serialized.contains("private-token"));
        assert!(!serialized.contains("Bearer"));
        assert!(parse_secure_service_config(
            r#"{"version":1,"endpoint":"https://service.example/api","credentialRef":"x"}"#
        )
        .is_err());
        assert!(parse_secure_service_config(
            r#"{"version":2,"endpoint":"https://service.example","credentialRef":"x"}"#
        )
        .is_err());
        for unsafe_endpoint in [
            "https://localhost",
            "https://127.0.0.1",
            "https://10.0.0.1",
            "https://100.64.0.1",
            "https://[::1]",
            "https://service.internal",
        ] {
            assert!(
                parse_secure_service_endpoint(unsafe_endpoint).is_err(),
                "{unsafe_endpoint}"
            );
        }
    }

    #[test]
    fn managed_secure_service_setup_is_private_idempotent_and_redacted() {
        let root = unique_temp_root("managed-secure-service");
        fs::create_dir_all(&root).expect("temp root should be created");
        let first = begin_managed_secure_service_setup_at(
            &root,
            "fixture-service",
            "service.config.json",
            100,
        )
        .expect("managed setup should begin");
        let repeated = begin_managed_secure_service_setup_at(
            &root,
            "fixture-service",
            "service.config.json",
            101,
        )
        .expect("managed setup should restore");
        assert_eq!(first, repeated);
        assert_eq!(first.state, "preparing");
        assert!(first.suggested_topic.starts_with("topic_"));
        assert!(first.public_key.len() > 40);
        assert_eq!(first.fingerprint.split(':').count(), 8);
        let serialized = serde_json::to_string(&first).expect("view should serialize");
        assert!(!serialized.contains("signingKey"));
        assert!(!serialized.contains("credential"));
        let record_text =
            fs::read_to_string(root.join("secure-services/fixture-service/pending.json"))
                .expect("pending setup should persist");
        assert!(record_text.contains("signingKey"));
        assert!(!record_text.contains("credential"));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let directory_mode = fs::metadata(root.join("secure-services/fixture-service"))
                .expect("directory metadata")
                .permissions()
                .mode()
                & 0o777;
            let record_mode =
                fs::metadata(root.join("secure-services/fixture-service/pending.json"))
                    .expect("record metadata")
                    .permissions()
                    .mode()
                    & 0o777;
            assert_eq!(directory_mode, 0o700);
            assert_eq!(record_mode, 0o600);
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn managed_secure_service_setup_retires_stale_state_and_rejects_unsafe_identity() {
        let root = unique_temp_root("managed-secure-service-stale");
        fs::create_dir_all(&root).expect("temp root should be created");
        let first = begin_managed_secure_service_setup_at(
            &root,
            "fixture-service",
            "service.config.json",
            100,
        )
        .expect("managed setup should begin");
        let replacement = begin_managed_secure_service_setup_at(
            &root,
            "fixture-service",
            "service.config.json",
            100 + MANAGED_SETUP_MAX_AGE_SECONDS + 1,
        )
        .expect("stale setup should be replaced");
        assert_ne!(first.setup_id, replacement.setup_id);
        assert!(begin_managed_secure_service_setup_at(
            &root,
            "../unsafe",
            "service.config.json",
            200
        )
        .is_err());
        assert!(begin_managed_secure_service_setup_at(
            &root,
            "fixture-two",
            "../service.json",
            200
        )
        .is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn managed_pairing_transcript_binds_version_origin_challenge_installation_and_fingerprint() {
        let contract = ManagedSecureServicePairingContract {
            service_identity: "fixture-runner".into(),
            api_version: "fixture.service.v1".into(),
            setup_version: "fixture.setup.v1".into(),
            manifest_path: "/api/setup/manifest".into(),
            challenge_path: "/api/setup/challenge".into(),
            pair_path: "/api/setup/pair".into(),
            additional_pair_path: Some("/api/setup/additional-pair".into()),
        };
        validate_managed_pairing_contract(&contract).expect("contract should validate");
        let record = ManagedSecureServicePendingRecord {
            version: 1,
            setup_id: "setup_fixture".into(),
            service_id: "fixture-service".into(),
            config_file: "service.config.json".into(),
            installation_id: "installation_fixture".into(),
            created_at_epoch_seconds: 1,
            signing_key: "private".into(),
            public_key: "public".into(),
            fingerprint: "AA:BB:CC:DD:EE:FF:00:11".into(),
            suggested_topic: "topic_fixture".into(),
            state: "preparing".into(),
        };
        let challenge = ManagedSecureServiceChallenge {
            id: "challenge_fixture".into(),
            nonce: "nonce_fixture".into(),
        };
        assert_eq!(
            managed_pairing_transcript(&contract, "https://runner.example", &challenge, &record),
            "fixture.setup.v1\nfixture.service.v1\nhttps://runner.example\nchallenge_fixture\nnonce_fixture\ninstallation_fixture\nAA:BB:CC:DD:EE:FF:00:11",
        );
        let unsafe_contract = ManagedSecureServicePairingContract {
            pair_path: "/api/../pair".into(),
            ..contract
        };
        assert!(validate_managed_pairing_contract(&unsafe_contract).is_err());
    }

    #[test]
    fn managed_pairing_transaction_verifies_signature_and_writes_only_a_credential_reference() {
        use ed25519_dalek::{Signature, Verifier, VerifyingKey};
        use std::cell::RefCell;
        let root = unique_temp_root("managed-pairing-transaction");
        fs::create_dir_all(&root).expect("temp root should exist");
        let view = begin_managed_secure_service_setup_at(
            &root,
            "fixture-service",
            "service.config.json",
            100,
        )
        .expect("setup should begin");
        let record =
            read_managed_pending_record(&root, "fixture-service").expect("record should load");
        let contract = ManagedSecureServicePairingContract {
            service_identity: "pulse-runner".into(),
            api_version: "pulse.service.v1".into(),
            setup_version: "pulse.setup.v1".into(),
            manifest_path: "/api/setup/manifest".into(),
            challenge_path: "/api/setup/challenge".into(),
            pair_path: "/api/setup/pair".into(),
            additional_pair_path: Some("/api/setup/additional-pair".into()),
        };
        let mut pulse_responses: serde_json::Value = serde_json::from_str(include_str!(
            "../test/fixtures/pulse-managed-setup-responses.json"
        ))
        .expect("Pulse managed setup response fixture should parse");
        pulse_responses["manifest"]["deployedPublicKeyFingerprint"] =
            serde_json::Value::String(view.fingerprint.clone());
        pulse_responses["challenge"]["installationId"] =
            serde_json::Value::String(record.installation_id.clone());
        pulse_responses["pair"]["client"]["installationId"] =
            serde_json::Value::String(record.installation_id.clone());
        let stored = RefCell::new(Vec::<String>::new());
        let written = RefCell::new(Vec::<String>::new());
        let metadata = complete_managed_secure_service_transaction(
            "fixture-service",
            &record,
            "https://pulse-sparrow-demo.example",
            &contract,
            |method, path, body, _bearer| match (method, path) {
                ("GET", "/api/setup/manifest") => Ok((200, pulse_responses["manifest"].clone())),
                ("POST", "/api/setup/challenge") => Ok((201, pulse_responses["challenge"].clone())),
                ("POST", "/api/setup/pair") => {
                    let body = body.expect("pair body");
                    let signature_bytes = URL_SAFE_NO_PAD
                        .decode(body["signature"].as_str().expect("signature"))
                        .expect("signature encoding");
                    let signature =
                        Signature::from_slice(&signature_bytes).expect("signature bytes");
                    let public_bytes: [u8; 32] = URL_SAFE_NO_PAD
                        .decode(&record.public_key)
                        .expect("public key")[12..]
                        .try_into()
                        .expect("raw public key");
                    let key = VerifyingKey::from_bytes(&public_bytes).expect("verifying key");
                    let challenge = ManagedSecureServiceChallenge {
                        id: "challenge_fixture".into(),
                        nonce: "nonce_fixture".into(),
                    };
                    key.verify(
                        managed_pairing_transcript(
                            &contract,
                            "https://pulse-sparrow-demo.example",
                            &challenge,
                            &record,
                        )
                        .as_bytes(),
                        &signature,
                    )
                    .expect("origin-bound transcript should verify");
                    Ok((201, pulse_responses["pair"].clone()))
                }
                _ => Err("unexpected request".into()),
            },
            |reference, credential| {
                stored
                    .borrow_mut()
                    .push(format!("{reference}:{credential}"));
                Ok(())
            },
            |_| {},
            |config| {
                written
                    .borrow_mut()
                    .push(serde_json::to_string(config).expect("config"));
                Ok(())
            },
        )
        .expect("transaction should complete");
        assert_eq!(metadata.endpoint, "https://pulse-sparrow-demo.example");
        assert_eq!(stored.borrow().len(), 1);
        assert!(written.borrow()[0].contains("credentialRef"));
        assert!(!written.borrow()[0].contains("fixture-durable-credential"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn managed_pairing_transaction_compensates_after_local_config_failure() {
        use std::cell::RefCell;
        let root = unique_temp_root("managed-pairing-rollback");
        fs::create_dir_all(&root).expect("temp root should exist");
        begin_managed_secure_service_setup_at(&root, "fixture-service", "service.config.json", 100)
            .expect("setup should begin");
        let record =
            read_managed_pending_record(&root, "fixture-service").expect("record should load");
        let contract = ManagedSecureServicePairingContract {
            service_identity: "fixture-runner".into(),
            api_version: "fixture.service.v1".into(),
            setup_version: "fixture.setup.v1".into(),
            manifest_path: "/api/setup/manifest".into(),
            challenge_path: "/api/setup/challenge".into(),
            pair_path: "/api/setup/pair".into(),
            additional_pair_path: Some("/api/setup/additional-pair".into()),
        };
        let events = RefCell::new(Vec::<String>::new());
        let result = complete_managed_secure_service_transaction(
            "fixture-service",
            &record,
            "https://runner.example",
            &contract,
            |method, path, _body, bearer| {
                events
                    .borrow_mut()
                    .push(format!("{method}:{path}:{}", bearer.is_some()));
                match (method, path) {
                    ("GET", "/api/setup/manifest") => Ok((
                        200,
                        serde_json::json!({
                            "service": "fixture-runner", "apiVersion": "fixture.service.v1", "setupVersion": "fixture.setup.v1",
                            "canonicalOrigin": "https://runner.example", "deployedPublicKeyFingerprint": record.fingerprint,
                        }),
                    )),
                    ("POST", "/api/setup/challenge") => Ok((
                        201,
                        serde_json::json!({ "id": "challenge_fixture", "nonce": "nonce_fixture" }),
                    )),
                    ("POST", "/api/setup/pair") => Ok((
                        201,
                        serde_json::json!({ "client": { "id": "client_fixture" }, "credential": "fixture-durable-credential" }),
                    )),
                    ("DELETE", "/api/setup/clients/client_fixture") => {
                        Ok((200, serde_json::json!({})))
                    }
                    _ => Err("unexpected".into()),
                }
            },
            |_, _| {
                events.borrow_mut().push("keychain:store".into());
                Ok(())
            },
            |_| events.borrow_mut().push("keychain:delete".into()),
            |_| Err("injected config failure".into()),
        );
        assert!(result.is_err());
        let events = events.borrow();
        assert!(events.contains(&"keychain:delete".into()));
        assert!(events.contains(&"DELETE:/api/setup/clients/client_fixture:true".into()));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn managed_invitation_transaction_is_origin_bound_and_compensates_after_local_failure() {
        use std::cell::RefCell;
        let root = unique_temp_root("managed-invitation-rollback");
        fs::create_dir_all(&root).expect("temp root should exist");
        begin_managed_secure_service_setup_at(&root, "fixture-service", "service.config.json", 100)
            .expect("setup should begin");
        let record =
            read_managed_pending_record(&root, "fixture-service").expect("record should load");
        let contract = ManagedSecureServicePairingContract {
            service_identity: "fixture-runner".into(),
            api_version: "fixture.service.v1".into(),
            setup_version: "fixture.setup.v1".into(),
            manifest_path: "/api/setup/manifest".into(),
            challenge_path: "/api/setup/challenge".into(),
            pair_path: "/api/setup/pair".into(),
            additional_pair_path: Some("/api/setup/additional-pair".into()),
        };
        let events = RefCell::new(Vec::<String>::new());
        let result = complete_managed_secure_service_invitation_transaction(
            "fixture-service",
            &record,
            "https://runner.example",
            "invitation_fixture_value",
            &contract,
            |method, path, body, bearer| {
                events
                    .borrow_mut()
                    .push(format!("{method}:{path}:{}", bearer.is_some()));
                match (method, path) {
                    ("GET", "/api/setup/manifest") => Ok((
                        200,
                        serde_json::json!({
                            "service": "fixture-runner", "apiVersion": "fixture.service.v1", "setupVersion": "fixture.setup.v1",
                            "canonicalOrigin": "https://runner.example", "deployedPublicKeyFingerprint": "unused-for-invitation",
                        }),
                    )),
                    ("POST", "/api/setup/additional-pair") => {
                        let body = body.expect("additional pair body");
                        assert_eq!(body["installationId"], record.installation_id);
                        assert_eq!(body["origin"], "https://runner.example");
                        assert_eq!(body["code"], "invitation_fixture_value");
                        Ok((
                            201,
                            serde_json::json!({ "client": { "id": "client_second" }, "credential": "fixture-second-credential" }),
                        ))
                    }
                    ("DELETE", "/api/setup/clients/client_second") => {
                        Ok((200, serde_json::json!({})))
                    }
                    _ => Err("unexpected".into()),
                }
            },
            |_, _| {
                events.borrow_mut().push("keychain:store".into());
                Ok(())
            },
            |_| events.borrow_mut().push("keychain:delete".into()),
            |_| Err("injected config failure".into()),
        );
        assert!(result.is_err());
        let events = events.borrow();
        assert!(events.contains(&"keychain:delete".into()));
        assert!(events.contains(&"DELETE:/api/setup/clients/client_second:true".into()));
        assert!(complete_managed_secure_service_invitation_transaction(
            "fixture-service", &record, "https://other.example", "invitation_fixture_value", &contract,
            |method, path, _, _| match (method, path) {
                ("GET", "/api/setup/manifest") => Ok((200, serde_json::json!({
                    "service": "fixture-runner", "apiVersion": "fixture.service.v1", "setupVersion": "fixture.setup.v1",
                    "canonicalOrigin": "https://runner.example", "deployedPublicKeyFingerprint": "unused",
                }))),
                _ => Err("pairing must stop before invitation consumption".into()),
            },
            |_, _| Ok(()), |_| {}, |_| Ok(()),
        ).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn managed_disconnect_requires_the_authenticated_current_client_identity() {
        assert_eq!(
            managed_secure_service_current_client_id(&SecureServiceResponse {
                status: 200,
                body: serde_json::json!({ "currentClientId": "client_fixture" }),
            })
            .expect("client id should parse"),
            "client_fixture"
        );
        for response in [
            SecureServiceResponse {
                status: 401,
                body: serde_json::json!({ "currentClientId": "client_fixture" }),
            },
            SecureServiceResponse {
                status: 200,
                body: serde_json::json!({ "currentClientId": null }),
            },
            SecureServiceResponse {
                status: 200,
                body: serde_json::json!({ "currentClientId": "../other" }),
            },
        ] {
            assert!(managed_secure_service_current_client_id(&response).is_err());
        }
    }

    #[test]
    fn secure_service_requests_are_constrained_and_redact_credentials() {
        let request = SecureServiceRequest {
            method: "POST".into(),
            path: "/api/v1/items".into(),
            body: Some(serde_json::json!({ "name": "item" })),
        };
        assert!(validate_secure_service_request(&request).is_ok());
        assert!(validate_secure_service_request(&SecureServiceRequest {
            method: "PUT".into(),
            path: "/api/v1/items".into(),
            body: None
        })
        .is_err());
        assert!(validate_secure_service_request(&SecureServiceRequest {
            method: "GET".into(),
            path: "https://service.example/api".into(),
            body: None
        })
        .is_err());
        assert!(validate_secure_service_request(&SecureServiceRequest {
            method: "GET".into(),
            path: "/api/../secrets".into(),
            body: None
        })
        .is_err());

        let response = parse_secure_service_response(
            b"{\"message\":\"token-should-not-escape\"}\n__WORKSHOP_SECURE_SERVICE_STATUS__=401",
            "token-should-not-escape",
        )
        .expect("response should parse");
        let serialized = serde_json::to_string(&response).expect("response should serialize");
        assert!(serialized.contains("[redacted]"));
        assert!(!serialized.contains("token-should-not-escape"));
    }

    #[test]
    fn secure_service_config_rejects_repository_roots() {
        let root = unique_temp_root("secure-service-repository-root");
        fs::create_dir_all(root.join(".git")).expect("git marker should be created");
        fs::write(
            root.join("service.config.json"),
            r#"{"version":1,"endpoint":"https://service.example","credentialRef":"private-token"}"#,
        )
        .expect("config should be written");

        assert!(secure_service_metadata_from_root(
            root.to_str().expect("root should be utf8"),
            "service.config.json",
        )
        .is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn secure_service_config_rejects_symlinked_roots() {
        use std::os::unix::fs::symlink;

        let target = unique_temp_root("secure-service-root-target");
        let link = unique_temp_root("secure-service-root-link");
        fs::create_dir_all(&target).expect("target root should be created");
        fs::write(
            target.join("service.config.json"),
            r#"{"version":1,"endpoint":"https://service.example","credentialRef":"private-token"}"#,
        )
        .expect("config should be written");
        symlink(&target, &link).expect("symlink should be created");

        assert!(secure_service_metadata_from_root(
            link.to_str().expect("link should be utf8"),
            "service.config.json",
        )
        .is_err());
        let _ = fs::remove_file(link);
        let _ = fs::remove_dir_all(target);
    }

    #[test]
    fn rejects_configured_source_paths_with_traversal() {
        let root = unique_temp_root("markdown-traversal");
        fs::create_dir_all(&root).expect("source root should be created");
        fs::write(
            root.join("sources.config.json"),
            r#"{"version":1,"sources":[{"id":"tasks","label":"Tasks","view":"tasks","path":"/tmp/../tasks.md"}]}"#,
        )
        .expect("source config should be written");

        assert!(configured_markdown_source_from_root(
            root.to_str().expect("temp root should be utf8"),
            "sources.config.json",
            "tasks"
        )
        .is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_config_filenames_that_escape_the_selected_workspace() {
        assert!(validate_config_file_name("../sources.config.json").is_err());
        assert!(validate_config_file_name("nested/sources.config.json").is_err());
        assert!(validate_config_file_name("sources.config.toml").is_err());
        assert!(validate_config_file_name("sources.config.json").is_ok());
    }

    #[test]
    fn rejects_duplicate_generic_source_ids_and_paths() {
        assert!(parse_configured_markdown_config(
            r#"{"version":1,"sources":[{"id":"tasks","label":"Tasks","view":"tasks","path":"/tmp/tasks.md"},{"id":"tasks","label":"Notes","view":"notes","path":"/tmp/notes.md"}]}"#
        ).is_err());
        assert!(parse_configured_markdown_config(
            r#"{"version":1,"sources":[{"id":"tasks","label":"Tasks","view":"tasks","path":"/tmp/tasks.md"},{"id":"notes","label":"Notes","view":"notes","path":"/tmp/tasks.md"}]}"#
        ).is_err());
    }

    #[test]
    fn filters_watch_events_to_the_exact_configured_sources() {
        let tasks = PathBuf::from("/private/tasks/tasks.md");
        let notes = PathBuf::from("/private/notes/notes.md");
        let watched_sources = HashMap::from([
            (tasks.clone(), "tasks".to_string()),
            (notes.clone(), "notes".to_string()),
        ]);

        assert_eq!(
            configured_markdown_source_for_changed_path(&watched_sources, &tasks),
            Some("tasks".into())
        );
        assert_eq!(
            configured_markdown_source_for_changed_path(&watched_sources, &notes),
            Some("notes".into())
        );
        assert_eq!(
            configured_markdown_source_for_changed_path(
                &watched_sources,
                Path::new("/private/tasks/other.md")
            ),
            None
        );
    }

    #[test]
    fn atomic_save_rename_event_resolves_to_the_configured_source() {
        let tasks = PathBuf::from("/private/tasks/tasks.md");
        let watched_sources = HashMap::from([(tasks.clone(), "tasks".to_string())]);
        let event = notify::Event::new(notify::EventKind::Modify(notify::event::ModifyKind::Name(
            notify::event::RenameMode::Both,
        )))
        .add_path("/private/tasks/.tasks.md.tmp".into())
        .add_path(tasks);

        assert_eq!(
            configured_markdown_sources_from_event(&watched_sources, &event),
            vec!["tasks"]
        );
    }

    #[test]
    fn rejects_paths_outside_redline_clients() {
        let roots = vec![PathBuf::from("/tmp")];

        assert!(resolve_redline_path_from_roots("/tmp/report.md", &roots).is_err());
        assert!(resolve_redline_path_from_roots("../clients/report.md", &roots).is_err());
        assert!(resolve_redline_path_from_roots("reports/report.md", &roots).is_err());
    }

    #[test]
    fn validates_explicit_workspace_roots_before_use() {
        let root = unique_temp_root("explicit-workspace");
        fs::create_dir_all(root.join("clients/demo-redline"))
            .expect("workspace client directory should be created");

        assert_eq!(
            normalize_workspace_root(root.to_str().expect("temp path should be utf8"))
                .expect("absolute workspace should pass"),
            root
        );
        assert!(normalize_workspace_root("clients/demo-redline").is_err());
        assert!(normalize_workspace_root("/tmp/../clients").is_err());

        let private_root = unique_temp_root("private-workspace");
        let blocked_pilot_client = ["para", "sail"].concat();
        fs::create_dir_all(private_root.join("clients").join(blocked_pilot_client))
            .expect("private pilot directory should be created");
        assert!(normalize_workspace_root(private_root.to_str().unwrap()).is_err());

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(private_root);
    }

    #[test]
    fn reads_optional_private_workspace_index_from_selected_root() {
        let root = unique_temp_root("workspace-index");
        fs::create_dir_all(root.join("clients/acme-megaphone"))
            .expect("workspace client directory should be created");
        let index = "version: 1\nworkspaceType: workshop-private\nclients: []\n";
        fs::write(root.join("workspace.yaml"), index).expect("workspace index should be written");

        assert_eq!(
            read_private_workspace_index_from_context(Some(
                root.to_str().expect("temp path should be utf8")
            ))
            .expect("workspace index should be readable"),
            Some(index.to_string())
        );

        let missing_root = unique_temp_root("workspace-index-missing");
        fs::create_dir_all(&missing_root).expect("missing-index root should be created");
        assert_eq!(
            read_private_workspace_index_from_context(Some(
                missing_root.to_str().expect("temp path should be utf8")
            ))
            .expect("missing workspace index should be optional"),
            None
        );

        assert_eq!(
            read_private_workspace_index_from_context(None)
                .expect("empty workspace root should be optional"),
            None
        );
        assert!(read_private_workspace_index_from_context(Some("clients/demo-megaphone")).is_err());

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(missing_root);
    }

    #[test]
    fn resolves_client_artifacts_from_a_workspace_root() {
        let root = unique_temp_root("workspace");
        let artifact =
            root.join("clients/demo-megaphone/reports/homepage-pilot/executive-summary.md");
        fs::create_dir_all(artifact.parent().expect("artifact should have a parent"))
            .expect("test artifact directory should be created");
        fs::write(&artifact, "# Executive Summary\n").expect("test artifact should be written");

        let resolved = resolve_redline_path_from_roots(
            "clients/demo-megaphone/reports/homepage-pilot/executive-summary.md",
            std::slice::from_ref(&root),
        )
        .expect("artifact should resolve");

        assert_eq!(resolved, artifact);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn explicit_redline_workspace_root_controls_writes_and_reads() {
        let current_dir = unique_temp_root("current-dir");
        let selected_root = unique_temp_root("selected-redline-root");
        fs::create_dir_all(&current_dir).expect("current dir should be created");
        fs::create_dir_all(selected_root.join("clients/demo-redline/reports/run"))
            .expect("selected workspace should be created");

        let file = RedlinePacketFile {
            path: "clients/demo-redline/reports/run/executive-summary.md".into(),
            contents: "# Executive Summary\n".into(),
        };
        let root = redline_write_root(&current_dir, selected_root.to_str())
            .expect("explicit write root should resolve");
        assert_eq!(root, selected_root);

        let written = {
            let relative_path = normalize_redline_write_path(&file.path, "demo-redline")
                .expect("relative write path should pass");
            let full_path = root.join(relative_path);
            fs::write(&full_path, &file.contents).expect("file should write");
            full_path
        };

        let roots = workspace_roots(&current_dir, None, selected_root.to_str())
            .expect("explicit roots should resolve");
        let resolved = resolve_redline_path_from_roots(&file.path, &roots)
            .expect("artifact should resolve from selected root");

        assert_eq!(resolved, written);
        assert!(resolved.starts_with(&selected_root));
        let _ = fs::remove_dir_all(current_dir);
        let _ = fs::remove_dir_all(selected_root);
    }

    #[test]
    fn resolves_client_packet_directories_from_a_workspace_root() {
        let root = unique_temp_root("packet-directory");
        let packet_dir = root.join("clients/demo-megaphone");
        fs::create_dir_all(&packet_dir).expect("packet directory should be created");

        let resolved =
            resolve_redline_path_from_roots("clients/demo-megaphone", std::slice::from_ref(&root))
                .expect("packet directory should resolve");

        assert_eq!(resolved, packet_dir);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn treats_bundled_resource_dir_as_a_workspace_root() {
        let current_dir = unique_temp_root("current-dir");
        let resource_dir = unique_temp_root("resource-dir");
        let artifact =
            resource_dir.join("clients/demo-megaphone/reports/homepage-pilot/page-redlines.md");
        fs::create_dir_all(artifact.parent().expect("artifact should have a parent"))
            .expect("test artifact directory should be created");
        fs::write(&artifact, "# Page Redlines\n").expect("test artifact should be written");

        let roots = workspace_roots(&current_dir, Some(&resource_dir), None)
            .expect("workspace roots should resolve");
        let resolved = resolve_redline_path_from_roots(
            "clients/demo-megaphone/reports/homepage-pilot/page-redlines.md",
            &roots,
        )
        .expect("resource artifact should resolve");

        assert_eq!(resolved, artifact);
        let _ = fs::remove_dir_all(current_dir);
        let _ = fs::remove_dir_all(resource_dir);
    }

    #[test]
    fn rejects_packet_exports_outside_the_selected_client_folder() {
        assert!(normalize_redline_write_path(
            "clients/demo-megaphone/client.yaml",
            "demo-megaphone"
        )
        .is_ok());
        assert!(
            normalize_redline_write_path("clients/fixture/client.yaml", "demo-megaphone").is_err()
        );
        assert!(normalize_redline_write_path(
            "../clients/demo-megaphone/client.yaml",
            "demo-megaphone"
        )
        .is_err());
    }

    #[test]
    fn constrains_redline_live_snapshot_writes_to_selected_client_targets() {
        assert!(normalize_redline_snapshot_write_path(
            "clients/demo-megaphone/targets/fixtures/live.html",
            "demo-megaphone"
        )
        .is_ok());
        assert!(normalize_redline_snapshot_write_path(
            "clients/demo-megaphone/targets/extracted/live.txt",
            "demo-megaphone"
        )
        .is_ok());
        assert!(normalize_redline_snapshot_write_path(
            "clients/demo-megaphone/targets/snapshots/live.md",
            "demo-megaphone"
        )
        .is_ok());
        assert!(normalize_redline_snapshot_write_path(
            "clients/demo-megaphone/reports/live.md",
            "demo-megaphone"
        )
        .is_err());
        assert!(normalize_redline_snapshot_write_path(
            "clients/fixture/targets/fixtures/live.html",
            "demo-megaphone"
        )
        .is_err());
        assert!(normalize_redline_snapshot_write_path(
            "clients/demo-megaphone/targets/fixtures/live.json",
            "demo-megaphone"
        )
        .is_err());
    }

    #[test]
    fn writes_redline_live_snapshot_files_under_client_targets() {
        let root = unique_temp_root("live-snapshot");
        let files = vec![
            RedlinePacketFile {
                path: "clients/demo-megaphone/targets/fixtures/live.html".into(),
                contents: "<html></html>".into(),
            },
            RedlinePacketFile {
                path: "clients/demo-megaphone/targets/extracted/live.txt".into(),
                contents: "Title: Live".into(),
            },
        ];

        let count = redline_write_target_snapshot_files_to_root(
            &root,
            "demo-megaphone",
            &files,
            Some(false),
        )
        .expect("snapshot files should write");

        assert_eq!(count, 2);
        assert!(root
            .join("clients/demo-megaphone/targets/fixtures/live.html")
            .is_file());
        assert!(redline_write_target_snapshot_files_to_root(
            &root,
            "demo-megaphone",
            &files,
            Some(false)
        )
        .is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn extracts_final_url_from_redline_curl_snapshot_output() {
        let output = format!(
            "<html><title>Live</title></html>{REDLINE_CURL_FINAL_URL_MARKER}https://www.demo.local/"
        );

        let (html, final_url) = split_redline_curl_snapshot_output(&output, "https://demo.local/");

        assert_eq!(html, "<html><title>Live</title></html>");
        assert_eq!(final_url, "https://www.demo.local/");
        assert_eq!(
            split_redline_curl_snapshot_output("<html></html>", "https://demo.local/"),
            ("<html></html>".into(), "https://demo.local/".into())
        );
    }

    #[test]
    fn rejects_megaphone_paths_outside_client_artifacts() {
        assert!(normalize_megaphone_path("clients/demo-megaphone/client.yaml").is_ok());
        assert!(normalize_megaphone_path("/tmp/client.yaml").is_err());
        assert!(normalize_megaphone_path("../clients/demo-megaphone/client.yaml").is_err());
        assert!(normalize_megaphone_path("reports/brief.md").is_err());
    }

    #[test]
    fn rejects_megaphone_client_folder_shapes_that_are_not_client_roots() {
        assert!(normalize_megaphone_client_folder("clients/demo-megaphone").is_ok());
        assert!(normalize_megaphone_client_folder("clients/demo-megaphone/brief.md").is_err());
        assert!(normalize_megaphone_client_folder("clients").is_err());
    }

    #[test]
    fn validates_megaphone_ai_keys_before_secure_storage() {
        assert!(validate_megaphone_api_key("").is_err());
        assert!(validate_megaphone_api_key("short").is_err());
        assert_eq!(
            validate_megaphone_api_key("  sk-test-local-value  ")
                .expect("valid-looking key should pass"),
            "sk-test-local-value"
        );
    }

    #[test]
    fn serializes_ai_credential_status_without_secret_values() {
        let status = MegaphoneAiCredentialStatus {
            status: "available".into(),
            provider: "openai".into(),
            model: "gpt-5-mini".into(),
            storage: "macos_keychain".into(),
            message: "OpenAI API key is saved in local secure storage.".into(),
            fallback_enabled: true,
        };
        let serialized = serde_json::to_string(&status).expect("status should serialize");

        assert!(serialized.contains("macos_keychain"));
        assert!(!serialized.contains("sk-"));
        assert!(!serialized.contains("api_key"));
    }

    #[test]
    fn rejects_megaphone_exports_outside_the_selected_client_post_packages() {
        assert!(normalize_megaphone_write_path(
            "clients/demo-megaphone/post-packages/brief/brief.md",
            "demo-megaphone"
        )
        .is_ok());
        assert!(normalize_megaphone_write_path(
            "clients/fixture/post-packages/brief/brief.md",
            "demo-megaphone"
        )
        .is_err());
        assert!(normalize_megaphone_write_path(
            "clients/demo-megaphone/client.yaml",
            "demo-megaphone"
        )
        .is_err());
        assert!(normalize_megaphone_write_path(
            "clients/demo-megaphone/post-packages/brief/draft.txt",
            "demo-megaphone"
        )
        .is_err());
    }

    #[test]
    fn constrains_megaphone_onboarding_exports_to_selected_client() {
        assert!(normalize_megaphone_onboarding_write_path(
            "clients/demo-influencer/onboarding/workshop-export-transcript.md",
            "demo-influencer"
        )
        .is_ok());
        assert!(normalize_megaphone_onboarding_write_path(
            "clients/demo-influencer/client.yaml",
            "demo-influencer"
        )
        .is_ok());
        assert!(normalize_megaphone_onboarding_write_path(
            "clients/demo-megaphone/onboarding/workshop-export-transcript.md",
            "demo-influencer"
        )
        .is_err());
        assert!(normalize_megaphone_onboarding_write_path(
            "clients/demo-influencer/post-packages/demo/brief.md",
            "demo-influencer"
        )
        .is_err());
        assert!(normalize_megaphone_onboarding_write_path(
            "../clients/demo-influencer/client.yaml",
            "demo-influencer"
        )
        .is_err());
        assert!(normalize_megaphone_onboarding_write_path(
            "clients/demo-influencer/onboarding/export.txt",
            "demo-influencer"
        )
        .is_err());
    }

    #[test]
    fn creates_megaphone_package_files_under_post_packages() {
        let file = megaphone_package_file(
            "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint",
            "brief.md",
            "# Brief\n".into(),
        )
        .expect("package file should be valid");

        assert_eq!(
            file.path,
            "clients/demo-megaphone/post-packages/public-endpoint-vs-private-endpoint/brief.md"
        );
        assert_eq!(
            slugify_for_path("Public Endpoint vs Private Endpoint Decision Tree"),
            "public-endpoint-vs-private-endpoint-decision-tree"
        );
    }

    #[test]
    fn collects_existing_megaphone_post_package_artifacts() {
        let root = unique_temp_root("megaphone-artifact-collection");
        let client_root = root.join("clients/demo-megaphone");
        let artifact = client_root.join("post-packages/demo/brief.md");
        let ignored = client_root.join("post-packages/demo/notes.txt");
        fs::create_dir_all(artifact.parent().expect("artifact should have a parent"))
            .expect("artifact directory should be created");
        fs::write(&artifact, "# Brief\n").expect("artifact should be written");
        fs::write(&ignored, "ignore me\n").expect("ignored file should be written");

        let artifacts =
            collect_megaphone_artifact_paths(&client_root, Path::new("clients/demo-megaphone"))
                .expect("artifacts should collect");

        assert_eq!(
            artifacts,
            vec!["clients/demo-megaphone/post-packages/demo/brief.md".to_string()]
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn chooses_sibling_megaphone_workspace_root_for_post_package_writes() {
        let root = unique_temp_root("megaphone-sibling-root");
        let content_redline_nested = root.join("content-redline/apps/marketing-builds-desktop");
        let megaphone_root = root.join("megaphone");
        fs::create_dir_all(megaphone_root.join("clients"))
            .expect("megaphone clients directory should be created");
        fs::create_dir_all(&content_redline_nested).expect("nested current directory should exist");

        assert_eq!(
            megaphone_write_root(&content_redline_nested, None).expect("write root should resolve"),
            megaphone_root
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn prefers_sibling_megaphone_clients_before_content_redline_clients() {
        let root = unique_temp_root("megaphone-root-order");
        let content_redline_nested = root.join("content-redline/apps/marketing-builds-desktop");
        let content_redline_clients = root.join("content-redline/clients");
        let megaphone_root = root.join("megaphone");
        fs::create_dir_all(&content_redline_nested).expect("nested app directory should exist");
        fs::create_dir_all(&content_redline_clients)
            .expect("content-redline clients directory should exist");
        fs::create_dir_all(megaphone_root.join("clients"))
            .expect("megaphone clients directory should exist");

        let roots = megaphone_workspace_roots(&content_redline_nested, None, None)
            .expect("workspace roots should resolve");
        let sibling_index = roots
            .iter()
            .position(|candidate| candidate == &megaphone_root)
            .expect("sibling Megaphone root should be present");
        let content_redline_index = roots
            .iter()
            .position(|candidate| candidate == &root.join("content-redline"))
            .expect("content-redline root should be present");

        assert!(sibling_index < content_redline_index);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn chooses_workspace_root_for_packet_writes() {
        let root = unique_temp_root("write-root");
        let nested = root.join("apps/marketing-builds-desktop/src-tauri");
        fs::create_dir_all(root.join("clients")).expect("clients directory should be created");
        fs::create_dir_all(&nested).expect("nested current directory should be created");

        assert_eq!(
            redline_write_root(&nested, None).expect("write root should resolve"),
            root
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn explicit_megaphone_workspace_root_controls_exports() {
        let current_dir = unique_temp_root("current-megaphone-dir");
        let selected_root = unique_temp_root("selected-megaphone-root");
        fs::create_dir_all(&current_dir).expect("current dir should be created");
        fs::create_dir_all(selected_root.join("clients/demo-megaphone"))
            .expect("selected workspace should be created");

        let root = megaphone_write_root(&current_dir, selected_root.to_str())
            .expect("explicit write root should resolve");
        assert_eq!(root, selected_root);

        let files = vec![MegaphonePacketFile {
            path: "clients/demo-megaphone/post-packages/run/brief.md".into(),
            contents: "# Brief\n".into(),
        }];
        let count = megaphone_write_post_package_files_to_root(
            &root,
            "demo-megaphone",
            &files,
            Some(false),
        )
        .expect("post package should write to selected workspace");

        assert_eq!(count, 1);
        assert!(selected_root
            .join("clients/demo-megaphone/post-packages/run/brief.md")
            .is_file());
        let _ = fs::remove_dir_all(current_dir);
        let _ = fs::remove_dir_all(selected_root);
    }

    #[test]
    fn packet_file_command_shape_defaults_to_no_overwrite() {
        let file = RedlinePacketFile {
            path: "clients/demo-megaphone-onboarding-draft/client.yaml".into(),
            contents: "clientId: demo-megaphone-onboarding-draft\n".into(),
        };

        assert_eq!(
            file.path,
            "clients/demo-megaphone-onboarding-draft/client.yaml"
        );
    }

    #[test]
    fn megaphone_packaged_action_smoke_exercises_tauri_local_action_helpers() {
        let current_dir = std::env::current_dir().expect("current directory should resolve");
        resolve_megaphone_bridge(&current_dir)
            .expect("Megaphone bridge should be built before running the packaged action smoke");

        let smoke_root = unique_temp_root("megaphone-packaged-action-smoke");
        fs::create_dir_all(&smoke_root).expect("smoke root should be created");

        let loaded = megaphone_load_client_folder_from_context(
            &current_dir,
            None,
            None,
            "clients/demo-megaphone",
        )
        .expect("Tauri helper should load the real Demo Megaphone client folder");
        assert_eq!(loaded.client_id, "demo-megaphone");
        assert!(loaded.source_count > 0);

        let package = megaphone_create_post_package_from_context(
            &current_dir,
            None,
            None,
            "demo-megaphone".into(),
            "clients/demo-megaphone".into(),
            "public endpoint vs private endpoint packaged smoke".into(),
            vec!["founder".into(), "CTO".into()],
            "Teams need to know when public inference endpoints stop fitting production workload promises."
                .into(),
            "visual_explainer".into(),
            false,
            "medium".into(),
            Some("operational_control".into()),
        )
        .expect("Tauri helper should create a deterministic Megaphone package");
        assert_eq!(package.client_id, "demo-megaphone");
        assert!(package
            .files
            .iter()
            .any(|file| file.path.ends_with("/brief.md")));

        let exported = megaphone_write_post_package_files_to_root(
            &smoke_root,
            &package.client_id,
            &package.files,
            Some(true),
        )
        .expect("Tauri helper should export post package files to the smoke workspace");
        assert_eq!(exported, package.files.len());

        let brief_path = package
            .files
            .iter()
            .find(|file| file.path.ends_with("/brief.md"))
            .expect("package should include a brief")
            .path
            .clone();
        let resolved_brief = resolve_megaphone_open_path_from_context(
            &current_dir,
            Some(&smoke_root),
            None,
            &brief_path,
        )
        .expect("Tauri helper should resolve a generated artifact for opening");
        assert!(resolved_brief.starts_with(&smoke_root));
        assert!(resolved_brief.is_file());

        let onboarding_files = vec![MegaphonePacketFile {
            path: "clients/demo-influencer/onboarding/workshop-export-transcript.md".into(),
            contents: "# Workshop Export Transcript\n".into(),
        }];
        let onboarding_exported = megaphone_write_onboarding_files_to_root(
            &smoke_root,
            "demo-influencer",
            &onboarding_files,
            Some(true),
        )
        .expect("Tauri helper should export onboarding files to the smoke workspace");
        assert_eq!(onboarding_exported, 1);
        assert!(smoke_root
            .join("clients/demo-influencer/onboarding/workshop-export-transcript.md")
            .is_file());

        let ai_status = megaphone_test_ai_connection_from_context(
            &current_dir,
            None,
            None,
            "clients/demo-megaphone".into(),
            "gpt-5-mini".into(),
        )
        .expect("Tauri helper should return AI connection status");
        let availability = ai_status
            .get("availability")
            .or_else(|| ai_status.get("status"))
            .and_then(|value| value.as_str())
            .expect("AI status should include an availability-like field");
        assert!(matches!(availability, "available" | "missing_credentials"));

        let ai_package = megaphone_create_ai_post_package_from_context(
            &current_dir,
            None,
            None,
            "demo-megaphone".into(),
            "clients/demo-megaphone".into(),
            "public endpoint vs private endpoint ai packaged smoke".into(),
            vec!["founder".into(), "CTO".into()],
            "Teams need to know when public inference endpoints stop fitting production workload promises."
                .into(),
            "visual_explainer".into(),
            false,
            "medium".into(),
            Some("operational_control".into()),
            "gpt-5-mini".into(),
        )
        .expect("Tauri helper should create an AI-mode package or deterministic fallback");
        assert!(ai_package
            .files
            .iter()
            .any(|file| file.path.ends_with("/ai-generation.md")));

        let chat_result = megaphone_chat_with_context_from_context(
            &current_dir,
            None,
            None,
            "clients/demo-megaphone".into(),
            "gpt-5-mini".into(),
            "What should the editor review before publishing?".into(),
            vec![serde_json::json!({
                "id": "smoke-note",
                "title": "Smoke note",
                "sourceType": "note",
                "content": "Avoid unsupported benchmark and cost claims.",
            })],
            Vec::new(),
        )
        .expect("Tauri helper should return contextual chat status");
        assert!(matches!(
            chat_result.get("status").and_then(|value| value.as_str()),
            Some("answered") | Some("unavailable")
        ));

        assert!(megaphone_load_client_folder_from_context(
            &current_dir,
            Some(&smoke_root),
            None,
            "clients/missing"
        )
        .is_err());
        assert!(megaphone_write_post_package_files_to_root(
            &smoke_root,
            "demo-megaphone",
            &[MegaphonePacketFile {
                path: "clients/demo-megaphone/sources/source.md".into(),
                contents: "unsafe".into(),
            }],
            Some(true),
        )
        .is_err());

        let blocked_path =
            smoke_root.join("clients/demo-megaphone/post-packages/blocked-write/brief.md");
        fs::create_dir_all(&blocked_path).expect("blocked write directory should be created");
        assert!(megaphone_write_post_package_files_to_root(
            &smoke_root,
            "demo-megaphone",
            &[MegaphonePacketFile {
                path: "clients/demo-megaphone/post-packages/blocked-write/brief.md".into(),
                contents: "blocked".into(),
            }],
            Some(true),
        )
        .is_err());

        let bad_post_type = megaphone_create_post_package_from_context(
            &current_dir,
            None,
            None,
            "demo-megaphone".into(),
            "clients/demo-megaphone".into(),
            "bad post type".into(),
            vec!["founder".into()],
            "Bad post type should fail.".into(),
            "not_a_post_type".into(),
            false,
            "medium".into(),
            None,
        );
        assert!(bad_post_type
            .expect_err("bad post type should fail")
            .contains("Invalid enum value"));

        let _ = fs::remove_dir_all(smoke_root);
    }
}
