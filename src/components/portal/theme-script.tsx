/** localStorage key for the Light / Dark / System choice. */
export const THEME_KEY = "bh-theme";

const CODE = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

/**
 * Tiny blocking script that applies the saved theme before first paint (no flash).
 * Put it in the root layout's <head>, and add suppressHydrationWarning to <html>.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: CODE }} />;
}
