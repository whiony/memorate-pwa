"use client";
import {THEME_IDS,THEMES,type ThemePreference} from '@/lib/themes';
export function ThemePicker({value,onChange}:{value:ThemePreference;onChange:(value:ThemePreference)=>void}){
 return <div className="theme-picker" role="group" aria-label="Theme">{THEME_IDS.map(id=>{const theme=THEMES[id==='system'?'light':id];return <button type="button" key={id} className="theme-option" aria-pressed={value===id} onClick={()=>onChange(id)}><span className="theme-preview" style={{background:theme.palette.background}} aria-hidden="true"><i style={{background:theme.palette.surface}}/><i style={{background:theme.palette.accent}}/><i style={{background:id==='system'?THEMES.dark.palette.surface:theme.palette.ink}}/></span><span>{id==='system'?'System':theme.name}</span></button>;})}</div>;
}
