import AsyncStorage from '@react-native-async-storage/async-storage';
import {createContext,type ReactNode,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
export type ThemeMode='system'|'light'|'dark';
type SettingsContextValue={notificationsEnabled:boolean;themeMode:ThemeMode;settingsReady:boolean;themeSaving:boolean;settingsError:string;setNotificationsEnabled:(enabled:boolean)=>void;setThemeMode:(mode:ThemeMode)=>void};
const THEME_MODE_STORAGE_KEY='@taswoq/theme-mode';
const isThemeMode=(value:string|null):value is ThemeMode=>value==='system'||value==='light'||value==='dark';
const SettingsContext=createContext<SettingsContextValue|null>(null);
export function SettingsProvider({children}:{children:ReactNode}){
 const [notificationsEnabled,setNotificationsEnabled]=useState(true),[themeMode,setTheme]=useState<ThemeMode>('system'),[settingsReady,setReady]=useState(false),[themeSaving,setSaving]=useState(false),[settingsError,setError]=useState('');
 const lock=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;let active=true;void AsyncStorage.getItem(THEME_MODE_STORAGE_KEY).then(value=>{if(active&&isThemeMode(value))setTheme(value);}).catch(()=>{if(active)setError('تعذر قراءة المظهر المحفوظ. يمكنك اختيار المظهر مجددًا.');}).finally(()=>{if(active)setReady(true);});return()=>{active=false;mounted.current=false;};},[]);
 const setThemeMode=useCallback((mode:ThemeMode)=>{
  if(!settingsReady||lock.current||!isThemeMode(mode))return;lock.current=true;setSaving(true);setError('');
  void AsyncStorage.setItem(THEME_MODE_STORAGE_KEY,mode).then(()=>{if(mounted.current)setTheme(mode);}).catch(()=>{if(mounted.current)setError('تعذر حفظ المظهر. بقي الاختيار السابق؛ أعد المحاولة.');}).finally(()=>{lock.current=false;if(mounted.current)setSaving(false);});
 },[settingsReady]);
 const value=useMemo(()=>({notificationsEnabled,themeMode,settingsReady,themeSaving,settingsError,setNotificationsEnabled,setThemeMode}),[notificationsEnabled,themeMode,settingsReady,themeSaving,settingsError,setThemeMode]);
 return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
export function useSettings(){const value=useContext(SettingsContext);if(!value)throw Error('useSettings must be used inside SettingsProvider');return value;}
