import {useCallback,useEffect,useRef,useState} from 'react';
import {useFocusEffect,useNavigation} from 'expo-router';
import {usePreventRemove} from 'expo-router/react-navigation';
import {BackHandler} from 'react-native';
import {AppConfirmModal} from '@/components/ui/AppModal';
export function useAccountDraftGuard(dirty:boolean,busy:boolean,leave:()=>void,isLocked?:()=>boolean){
 const navigation=useNavigation(),allow=useRef(false),pending=useRef<(()=>void)|null>(null),busyRef=useRef(busy);
 useEffect(()=>{busyRef.current=busy;},[busy]);
 const [confirm,setConfirm]=useState(false),[waiting,setWaiting]=useState(false);
 const request=useCallback((action:()=>void)=>{if(allow.current){action();return;}if(busyRef.current||isLocked?.()){setWaiting(true);return;}if(dirty){if(!pending.current){pending.current=action;setConfirm(true);}return;}action();},[dirty,isLocked]);
 usePreventRemove(dirty||busy,({data})=>request(()=>navigation.dispatch(data.action)));
 useFocusEffect(useCallback(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{request(leave);return true;});return()=>sub.remove();},[request,leave]));
 const modal=<><AppConfirmModal design="refined" visible={confirm} title="تجاهل التعديلات؟" message="لم تُحفظ هذه التغييرات. هل تريد العودة دون حفظها؟" destructive onCancel={()=>{pending.current=null;setConfirm(false);}} onConfirm={()=>{if(busyRef.current||isLocked?.())return;allow.current=true;setConfirm(false);const action=pending.current;pending.current=null;action?.();}}/><AppConfirmModal design="refined" visible={waiting} title="العملية قيد التنفيذ" message="انتظر تأكيد النتيجة قبل مغادرة الصفحة." onCancel={()=>setWaiting(false)} onConfirm={()=>setWaiting(false)}/></>;
 return {back:()=>request(leave),modal};
}
