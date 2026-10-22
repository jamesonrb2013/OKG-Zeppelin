import { NavigationGuard } from "vue-router";
import { RootStore } from "./store";

const isAuthenticated = async () => {
  if (RootStore.state.auth.apiKey) return true; // We have an API key -> authenticated
  if (RootStore.state.auth.loadedInitialAuth) return false; // No API key and initial auth data was already loaded -> not authenticated
  await RootStore.dispatch("auth/loadInitialAuth"); // Initial auth data wasn't loaded yet (per above check) -> load it now
  if (RootStore.state.auth.apiKey) return true;
  return false; // Still no API key -> not authenticated
};

export const authGuard: NavigationGuard = async (to, from, next) => {
  if (await isAuthenticated()) return next();
  window.location.href = `${window.API_URL}/auth/login`;
};

export const loginCallbackGuard: NavigationGuard = async (to, from, next) => {
  if (to.query.apiKey) {
    await RootStore.dispatch("auth/setApiKey", { key: to.query.apiKey });
    window.location.href = "/dashboard";
  } else {
    window.location.href = `/?error=noAccess`;
  }
  return next();
};


export const staffOnlyGuard: NavigationGuard = async (to, from, next) => {
  if (!(await isAuthenticated())) {
    window.location.href = `${window.API_URL}/auth/login`;
    return next(false);
  }

  try {
    const response = await fetch(`${window.API_URL}/staff/status`, {
      headers: { "X-Api-Key": RootStore.state.auth.apiKey || "" },
    });
    if (!response.ok) return next("/dashboard");
    const result = await response.json();
    if (result?.isStaff === true) return next();
  } catch {
    // Fail closed: never show the owner-only page if staff status cannot be verified.
  }

  return next("/dashboard");
};

export const authRedirectGuard: NavigationGuard = async (to, form, next) => {
  if (await isAuthenticated()) return next("/dashboard");
  window.location.href = `${window.API_URL}/auth/login`;
  return next();
};
