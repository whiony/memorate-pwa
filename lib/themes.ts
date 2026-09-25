export const THEME_IDS = ['system','light','dark','amoled','rose-sand','sage','lavender-dusk','terracotta','ocean','matcha','peach','berry','butter','slate'] as const;
export type ThemePreference = typeof THEME_IDS[number];
export type Palette={background:string;surface:string;soft:string;ink:string;sub:string;line:string;input:string;accent:string;strong:string;dark?:boolean};
export const THEMES:Record<Exclude<ThemePreference,'system'>,{name:string;palette:Palette}>={
 light:{name:'Light',palette:{background:'#f2eae6',surface:'#fcf8f5',soft:'#eae0dc',ink:'#302a29',sub:'#695f5b',line:'#ded2cd',input:'#93837c',accent:'#d96558',strong:'#a64339'}},
 dark:{name:'Dark',palette:{background:'#211c1c',surface:'#2c2524',soft:'#392f2e',ink:'#f4ebe6',sub:'#baa9a3',line:'#4b3d3a',input:'#94817a',accent:'#e68172',strong:'#f3a091',dark:true}},
 amoled:{name:'AMOLED',palette:{background:'#000000',surface:'#151211',soft:'#251e1d',ink:'#f4ebe6',sub:'#baa9a3',line:'#382e2c',input:'#94817a',accent:'#e68172',strong:'#f3a091',dark:true}},
 'rose-sand':{name:'Rose Sand',palette:{background:'#f0e3df',surface:'#fff8f5',soft:'#ead6d0',ink:'#3b292b',sub:'#6c555a',line:'#d7beb8',input:'#957b78',accent:'#b55160',strong:'#97404e'}},
 sage:{name:'Sage',palette:{background:'#e8ece3',surface:'#fafbf5',soft:'#dce4d5',ink:'#29372d',sub:'#526350',line:'#c9d2c1',input:'#7d8b76',accent:'#577650',strong:'#43603d'}},
 'lavender-dusk':{name:'Lavender Dusk',palette:{background:'#292632',surface:'#35303f',soft:'#453d51',ink:'#f2edf6',sub:'#c2b6cf',line:'#594e65',input:'#94839f',accent:'#b6a0d1',strong:'#d1b9ed',dark:true}},
 terracotta:{name:'Terracotta',palette:{background:'#efe2d7',surface:'#fff8ee',soft:'#e8d0bd',ink:'#412d25',sub:'#6d513f',line:'#d8bea9',input:'#98755d',accent:'#a75236',strong:'#8a412b'}},
 ocean:{name:'Ocean',palette:{background:'#202f38',surface:'#2b3c47',soft:'#374d58',ink:'#edf5f4',sub:'#b1c6cb',line:'#52666f',input:'#829ca6',accent:'#91c6d0',strong:'#b2dfe4',dark:true}},
 matcha:{name:'Matcha',palette:{background:'#e8e7d4',surface:'#fbfaee',soft:'#dddec1',ink:'#353b28',sub:'#5a5f40',line:'#c8ccad',input:'#868b65',accent:'#727e40',strong:'#55622e'}},
 peach:{name:'Peach',palette:{background:'#f4e3d7',surface:'#fff8f0',soft:'#efd5c0',ink:'#422e28',sub:'#705243',line:'#dec2ad',input:'#9c7860',accent:'#ad593c',strong:'#91462e'}},
 berry:{name:'Berry',palette:{background:'#342633',surface:'#44303f',soft:'#583c50',ink:'#faeef5',sub:'#d3b7c9',line:'#715466',input:'#ad859e',accent:'#df9abd',strong:'#f1bad5',dark:true}},
 butter:{name:'Butter',palette:{background:'#f2ebce',surface:'#fffced',soft:'#eae0b5',ink:'#3e3723',sub:'#695c3e',line:'#d5c89b',input:'#958358',accent:'#927027',strong:'#74551a'}},
 slate:{name:'Slate',palette:{background:'#e3e8eb',surface:'#f7fafb',soft:'#d6e0e5',ink:'#293540',sub:'#50616d',line:'#bfccd4',input:'#7b8f9c',accent:'#526f88',strong:'#3c566d'}},
};
export function themeTokens(p:Palette):Record<string,string>{return {
 '--background':p.background,'--foreground':p.ink,'--card':p.surface,'--card-foreground':p.ink,'--popover':p.surface,'--popover-foreground':p.ink,
 '--primary':p.dark?p.accent:p.strong,'--primary-foreground':p.dark?p.background:'#ffffff','--secondary':p.soft,'--secondary-foreground':p.ink,'--muted':p.soft,'--muted-foreground':p.sub,
 '--accent':p.soft,'--accent-foreground':p.ink,'--destructive':p.dark?'#ffaaa2':'#a23831','--border':p.line,'--input':p.input,'--ring':p.strong,
 '--surface':p.surface,'--soft':p.soft,'--ink':p.ink,'--sub':p.sub,'--line':p.line,'--coral':p.accent,'--coral-strong':p.strong,
 '--sidebar':p.background,'--sidebar-foreground':p.ink,'--sidebar-primary':p.strong,'--sidebar-primary-foreground':p.dark?p.background:'#fff','--sidebar-accent':p.soft,'--sidebar-accent-foreground':p.ink,'--sidebar-border':p.line,'--sidebar-ring':p.strong,
 '--category-food':p.dark?'#d7bb8a':'#96733d','--category-places':p.dark?'#99c3b9':'#4c796b','--category-clothes':p.dark?'#c5add6':'#8a649b','--category-beauty':p.dark?'#e3ada6':'#a7635a','--category-other':p.dark?'#b1c1c7':'#657d85',
};}
export function categoryColor(category?:{id:string;color:string}){return category&&['food','places','clothes','beauty','other'].includes(category.id)?`var(--category-${category.id}, ${category.color})`:category?.color||'var(--sub)';}
export function applyTheme(theme:ThemePreference){const key=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;const palette=(THEMES[key]||THEMES.light).palette;document.documentElement.dataset.theme=key;document.documentElement.style.colorScheme=palette.dark?'dark':'light';for(const [key,value] of Object.entries(themeTokens(palette)))document.documentElement.style.setProperty(key,value);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',palette.background);}
