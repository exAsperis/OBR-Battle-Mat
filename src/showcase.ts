async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard access was unavailable.");
}

const button = document.querySelector<HTMLButtonElement>("#copy-manifest");
const statusElement = document.querySelector<HTMLElement>("#copy-status");

button?.addEventListener("click", async () => {
  const manifestUrl = button.dataset.manifestUrl;
  if (!manifestUrl || !statusElement) return;
  button.disabled = true;
  try {
    await copyText(manifestUrl);
    button.textContent = "Copied!";
    statusElement.textContent = "Manifest URL copied to your clipboard.";
  } catch {
    button.textContent = "Copy manifest";
    statusElement.textContent = `Copy failed. Paste this URL manually: ${manifestUrl}`;
  } finally {
    button.disabled = false;
  }
});

export {};
