/* Thin REST client — wraps fetch, attaches the JWT, normalises errors. */
const Api = (() => {
  let token = localStorage.getItem("grilledcoin_token") || null;

  function setToken(t) {
    token = t;
    if (t) localStorage.setItem("grilledcoin_token", t);
    else localStorage.removeItem("grilledcoin_token");
  }

  function getToken() {
    return token;
  }

  async function request(method, path, body) {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;

    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      /* empty body */
    }

    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      const err = new Error(message);
      // Attach extra fields from the server response so callers can inspect them
      if (data) {
        if (data.emailNotVerified) err.emailNotVerified = true;
        if (data.email) err.email = data.email;
      }
      throw err;
    }
    return data;
  }

  const get = (path) => request("GET", path);
  const post = (path, body) => request("POST", path, body);
  const patch = (path, body) => request("PATCH", path, body);
  const del = (path) => request("DELETE", path);

  return {
    setToken,
    getToken,
    get,
    post,
    patch,
    delete: del,
    // Convenience wrappers used throughout the app:
    register: (payload) => post("/auth/register", payload),
    login: (payload) => post("/auth/login", payload),
    me: () => get("/auth/me"),
    faucet: (amount) => post("/wallet/faucet", { amount }),
  };
})();
