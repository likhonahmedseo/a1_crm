function updateDraftPreview(index) {
  const drafts = window.__drafts || [];
  const selected = drafts[index];
  if (!selected) {
    return;
  }

  document.getElementById("previewEmail").textContent = selected.email;
  document.getElementById("previewSubject").textContent = selected.subject;
  document.getElementById("previewStatus").textContent = selected.status;
  document.getElementById("previewBody").value = selected.body;
  document.getElementById("previewGmailLink").href = selected.gmail_url;

  document.querySelectorAll(".draft-item").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.draftIndex) === index);
  });
}

function openGmailTabs() {
  const drafts = window.__drafts || [];
  const limitInput = document.getElementById("gmailOpenLimit");
  if (!drafts.length || !limitInput) {
    return;
  }

  const limit = Math.max(1, Math.min(Number(limitInput.value || 1), drafts.length));
  drafts.slice(0, limit).forEach((draft) => {
    window.open(draft.gmail_url, "_blank", "noopener,noreferrer");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".draft-item").forEach((button) => {
    button.addEventListener("click", () => {
      updateDraftPreview(Number(button.dataset.draftIndex));
    });
  });

  const gmailButton = document.getElementById("openGmailTabs");
  if (gmailButton) {
    gmailButton.addEventListener("click", openGmailTabs);
  }
});
