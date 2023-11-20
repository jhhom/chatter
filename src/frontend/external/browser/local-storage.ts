import { useLocalStorage } from "usehooks-ts";
// import { useLocalStorage } from "@uidotdev/usehooks";

const STORAGE_PREFIX = "tinode_clone_";
const TOKEN_KEY = `${STORAGE_PREFIX}token`;

const storage = {
  setToken: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  token: () => window.localStorage.getItem(TOKEN_KEY),
  clearToken: () => window.localStorage.removeItem(TOKEN_KEY),
};

export function useLocalStorageAuthToken() {
  const [token, setToken] = useLocalStorage(TOKEN_KEY, "");

  return {
    token:
      typeof token === "string" && token !== ""
        ? (JSON.parse(token) as string)
        : "",
    setToken: (t: string) => setToken(JSON.stringify(t)),
    clearToken: () => setToken(""),
  };
}

export default storage;
