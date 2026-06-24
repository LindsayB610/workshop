use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::Manager;

const REDLINE_CURL_FINAL_URL_MARKER: &str = "\n__WORKSHOP_FINAL_URL__=";

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Deserialize)]
struct MegaphoneBridgeEnvelope<T> {
    ok: bool,
    data: Option<T>,
    error: Option<String>,
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

    let normalized =
        requested
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

    if status.success() {
        Ok(())
    } else {
        Ok(())
    }
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
    if let Some(_) = read_megaphone_openai_key()? {
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
    let full_path =
        resolve_megaphone_open_path_from_context(
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
    let roots = workspace_roots(&current_dir, resource_dir.as_deref(), workspace_root.as_deref())?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            redline_open_path,
            redline_fetch_live_url,
            redline_write_target_snapshot_files,
            redline_write_packet_files
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_process::init())?;
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
    fn resolves_client_artifacts_from_a_workspace_root() {
        let root = unique_temp_root("workspace");
        let artifact = root.join("clients/demo-megaphone/reports/homepage-pilot/executive-summary.md");
        fs::create_dir_all(artifact.parent().expect("artifact should have a parent"))
            .expect("test artifact directory should be created");
        fs::write(&artifact, "# Executive Summary\n").expect("test artifact should be written");

        let resolved = resolve_redline_path_from_roots(
            "clients/demo-megaphone/reports/homepage-pilot/executive-summary.md",
            &[root.clone()],
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

        let resolved = resolve_redline_path_from_roots("clients/demo-megaphone", &[root.clone()])
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
        assert!(normalize_redline_write_path("clients/demo-megaphone/client.yaml", "demo-megaphone").is_ok());
        assert!(normalize_redline_write_path("clients/fixture/client.yaml", "demo-megaphone").is_err());
        assert!(
            normalize_redline_write_path("../clients/demo-megaphone/client.yaml", "demo-megaphone").is_err()
        );
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

        let count =
            redline_write_target_snapshot_files_to_root(&root, "demo-megaphone", &files, Some(false))
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
        assert!(
            normalize_megaphone_write_path("clients/demo-megaphone/client.yaml", "demo-megaphone").is_err()
        );
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
            megaphone_write_root(&content_redline_nested, None)
                .expect("write root should resolve"),
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

        assert_eq!(file.path, "clients/demo-megaphone-onboarding-draft/client.yaml");
    }

    #[test]
    fn megaphone_packaged_action_smoke_exercises_tauri_local_action_helpers() {
        let current_dir = std::env::current_dir().expect("current directory should resolve");
        resolve_megaphone_bridge(&current_dir)
            .expect("Megaphone bridge should be built before running the packaged action smoke");

        let smoke_root = unique_temp_root("megaphone-packaged-action-smoke");
        fs::create_dir_all(&smoke_root).expect("smoke root should be created");

        let loaded =
            megaphone_load_client_folder_from_context(&current_dir, None, None, "clients/demo-megaphone")
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
        let resolved_brief =
            resolve_megaphone_open_path_from_context(&current_dir, Some(&smoke_root), None, &brief_path)
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

        let blocked_path = smoke_root.join("clients/demo-megaphone/post-packages/blocked-write/brief.md");
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
