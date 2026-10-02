export const THEME_KEY = "helix-re:theme";

/** Runs before paint (inlined in <head>) so a light-mode user never sees a dark flash. Dark is the default. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");document.documentElement.classList.toggle("dark",t!=="light")}catch(e){document.documentElement.classList.add("dark")}`;
