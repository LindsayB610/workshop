# Slate

Slate is an independently versioned, local-first Markdown viewer. To start:

1. From Workshop, select **Add New Tools** and install **Slate**.
2. Create a private Slate folder outside the Workshop repository.
3. Put a `slate.config.json` file in that folder.
4. Open Slate, select that private Slate folder, and choose **Connect**.

`slate.config.json` lists the Markdown files Slate may read. Every source has
an absolute `path`, a unique `id`, a display `label`, and a supported `view`.
Slate reads and watches only those declared files; it does not scan nearby
folders, copy source text into Workshop, or synchronize your data.

For a complete example configuration, supported views, update instructions, and
troubleshooting, read [Using Workshop](https://github.com/LindsayB610/workshop/blob/main/docs/using-workshop.md).
The [Slate README](https://github.com/LindsayB610/slate) documents Slate's full
configuration contract.
