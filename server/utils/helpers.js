function block(label, text) {
  const regex = new RegExp(`\\[${label}\\]([\\s\\S]*?)(?=\\n\\[|$)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

function escapeHTML(text) {
  if (!text) return "";

  return text
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

module.exports = {
  block,
  escapeHTML
};