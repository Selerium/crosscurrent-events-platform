/** Runs before paint to apply the theme cookie and avoid a flash of the wrong mode. */
export function ThemeScript() {
  const script = `
(function () {
  try {
    var match = document.cookie.match(/(?:^|;\\s*)theme=(light|dark)/);
    var theme = match ? match[1] : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`.trim();

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
