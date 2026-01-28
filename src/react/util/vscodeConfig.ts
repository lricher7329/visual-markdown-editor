let configs: unknown = null;

export function getConfigs(): unknown {
    if (configs) return configs;
    const elem = document.getElementById('office-configs');
    if (!elem) return null;
    const value = elem.getAttribute('data-config');
    if (!value || value === '{{configs}}') return null;
    try {
        configs = JSON.parse(value);
        return configs;
    } catch {
        return null;
    }
}
