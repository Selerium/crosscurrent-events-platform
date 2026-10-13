import api from "./axios";

/** GET a blob endpoint and save it as a file (same pattern as admin exports). */
export async function downloadBlob(endpoint: string, filename: string) {
  const res = await api.get(endpoint, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
