export function isActive(path) {
  try {
    return window && window.location && window.location.pathname === path;
  } catch (e) {
    return false;
  }
}
