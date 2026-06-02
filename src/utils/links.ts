import { open } from '@tauri-apps/plugin-shell';

export function openExternalLink(url: string) {
  open(url).catch(() => window.open(url, '_blank'));
}
