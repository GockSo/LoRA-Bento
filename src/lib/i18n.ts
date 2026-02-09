export type Language = 'en' | 'ja' | 'zh';
export type Theme = 'light' | 'dark' | 'gockso';

export const translations = {
    en: {
        'settings.title': 'Settings',
        'settings.language': 'Language',
        'settings.theme': 'Theme',
        'settings.theme.light': 'Light',
        'settings.theme.dark': 'Dark',
        'settings.theme.gockso': 'Gock So',
        'nav.dashboard': 'Dashboard',
        'nav.projects': 'Projects',
        'nav.import': 'Import Project',
        'nav.new': 'New Project',
    },
    ja: {
        'settings.title': '設定',
        'settings.language': '言語',
        'settings.theme': 'テーマ',
        'settings.theme.light': 'ライト',
        'settings.theme.dark': 'ダーク',
        'settings.theme.gockso': 'Gock So',
        'nav.dashboard': 'ダッシュボード',
        'nav.projects': 'プロジェクト',
        'nav.import': 'インポート',
        'nav.new': '新規プロジェクト',
    },
    zh: {
        'settings.title': '设置',
        'settings.language': '语言',
        'settings.theme': '主题',
        'settings.theme.light': '浅色',
        'settings.theme.dark': '深色',
        'settings.theme.gockso': 'Gock So',
        'nav.dashboard': '仪表盘',
        'nav.projects': '项目',
        'nav.import': '导入项目',
        'nav.new': '新建项目',
    },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(key: TranslationKey, lang: Language): string {
    return translations[lang][key] || translations['en'][key] || key;
}
