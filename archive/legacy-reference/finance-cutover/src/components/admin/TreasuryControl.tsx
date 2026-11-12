import {useCallback,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {useAuth} from '@/context/AuthContext';
import {useTheme} from '@/context/ThemeContext';
import {Typography,Spacing} from '@/constants/theme';
import {AccountShell} from '@/components/account/AccountShell';
import {AppButton} from '@/components/ui/AppButton';
import {AppModal} from '@/components/ui/AppModal';
import {AppTextField} from '@/components/ui/AppTextField';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {DocumentReference} from '@/components/ui/DocumentReference';
import {FinancialStatus} from '@/components/ui/FinancialStatus';
import {FinancialOperationControls} from '@/components/ui/FinancialOperationControls';
import {TreasuryFinanceWorkflow} from '@/components/admin/TreasuryFinanceWorkflow';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {useFinancialOperation} from '@/hooks/useFinancialOperation';
import {getTreasury,normalizeTreasuryInput,treasuryOperationApi,type TreasuryView,type TreasuryInput,type TreasuryRow} from '@/lib/treasury-control';

const pages:{view:TreasuryView;label:string}[]=[{view:'dashboard',label:'لوحة الخزينة'},{view:'ledger',label:'سجل الحركات'},{view:'expenses',label:'المصروفات'},{view:'counts',label:'الجرد النقدي'},{view:'differences',label:'الفروقات والمراجعة'},{view:'opening',label:'السند الافتتاحي'}];
const names:Record<string,string>={start:'بدء جرد',count:'نتيجة الجرد',cancel_count:'إلغاء جلسة الجرد',review:'مراجعة فرق — دون تصحيح',expense_request:'طلب مصروف — غير مصروف',opening_request:'طلب افتتاحي — غير مرحّل',c5_confirm:'قبض عهدة سائق',c6_pay:'صرف أجر سائق',c7_pay:'صرف مستحق تاجر',c8_collect:'قبض اشتراك'};
export function TreasuryControl(){const {user}=useAuth();return user?<OwnedTreasury key={user.id} actor={user.id}/>:null;}
function OwnedTreasury({actor}:{actor:string}){
 const {colors}=useTheme(),router=useRouter(),[view,setView]=useState<TreasuryView>('dashboard'),[page,setPage]=useState(0),[direction,setDirection]=useState<'all'|'in'|'out'>('all'),[from,setFrom]=useState<string|null>(null),[selected,setSelected]=useState<TreasuryRow|null>(null);
 const [command,setCommand]=useState<'start'|'count'|'cancel_count'|'review'|null>(null),[session,setSession]=useState(''),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[inputError,setInputError]=useState('');
 const financeKind=view==='expenses'?'expense':view==='differences'?'adjustment':view==='opening'?'opening':null;
 const read=useCallback(async()=>financeKind?null:getTreasury(actor,view,page,from,null,direction),[actor,view,page,from,direction,financeKind]);
 const {data,loading,error,refresh}=useCustodyRead(`treasury:${actor}:${view}:${page}:${from}:${direction}`,read);
 useFocusEffect(useCallback(()=>{const timer=setInterval(refresh,15000);return()=>clearInterval(timer);},[refresh]));
 const operation=useFinancialOperation(actor,'office',refresh,treasuryOperationApi);
 const open=(kind:'start'|'count'|'cancel_count'|'review',sessionId='')=>{setCommand(kind);setSession(sessionId);setAmount('');setReason('');setInputError('');};
 const submit=async()=>{if(!command||operation.busy)return;try{const base={reason};let input:TreasuryInput;
  if(command==='count')input={...base,kind:command,session_id:session,amount};else if(command==='cancel_count'||command==='review')input={...base,kind:command,session_id:session};
  else input={...base,kind:'start'};
  input=normalizeTreasuryInput(input);setInputError('');setCommand(null);await operation.run(input);
 }catch(cause){setInputError(cause instanceof Error?cause.message:'تعذر تسجيل العملية.');}};
 const text=(value:string)=> <Text style={{...Typography.body,color:colors.text,textAlign:'right'}}>{value}</Text>;
 const msg=operation.result?.state==='completed'?'حُفظ سجل الرقابة؛ لم يُنشأ قبض أو صرف أو تصحيح مالي.':operation.result?.state==='rejected'?({c9_disabled:'التفعيل مغلق.',cash_moved_restart_count:'تحرك النقد أثناء الجرد؛ ألغِ الجلسة وابدأ جردًا جديدًا.',count_already_open:'توجد جلسة جرد مفتوحة.',already_completed:'سُجلت النتيجة مسبقًا.',session_unavailable:'جلسة الجرد غير متاحة.'}[operation.result.code]??'رُفضت العملية؛ حدّث البيانات.'):'تعذر إثبات النتيجة؛ استعد المحاولة نفسها.';
 return <AccountShell header={null} keyboardAware><View style={{gap:Spacing.three}}>
 {text('الخزينة المركزية — C2 فقط، منفصلة عن النظام القديم')}
 <AppButton design="refined" title="العودة إلى المالية" variant="outline" disabled={operation.busy} onPress={()=>router.push('/admin/finance')}/>
 <View style={{flexDirection:'row-reverse',flexWrap:'wrap',gap:Spacing.two}}>{pages.map(p=><AppButton design="refined" key={p.view} title={p.label} variant={view===p.view?'primary':'outline'} disabled={operation.busy} onPress={()=>{setView(p.view);setPage(0);setSelected(null);}}/>)}</View>
 <AppButton design="refined" title="تحديث الخزينة" variant="outline" onPress={refresh}/>
 {financeKind?<TreasuryFinanceWorkflow key={`${actor}:${financeKind}`} actor={actor} kind={financeKind}/>:null}
 {!financeKind&&loading?<ActivityIndicator color={colors.primary}/>:null}{!financeKind&&error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error} لا نعوّض الرصيد بصفر.</Text>:null}
 {data?<>
 {!data.enabled?<FinancialStatus label="C9 مغلق افتراضيًا؛ القراءة بحسب الصلاحية" tone="warning"/>:null}
 {view==='dashboard'&&data.metrics?<>
 <FinancialAmount amount={data.metrics.treasury} label="نقد المكتب المسجل في C2"/>
 <FinancialAmount amount={data.metrics.receipts} label="مقبوضات الفترة"/><FinancialAmount amount={data.metrics.payments} label="مدفوعات الفترة"/><FinancialAmount amount={data.metrics.net} label="صافي حركة الفترة"/>
 <FinancialAmount amount={data.metrics.driver_cash} label="نقد بعهدة السائقين — خارج خزينة المكتب"/>
 <FinancialAmount amount={data.metrics.driver_payable} label="التزام أجور السائقين غير المصروفة"/><FinancialAmount amount={data.metrics.merchant_payable} label="التزام مستحقات التجار غير المصروفة"/>
 <FinancialAmount amount={data.metrics.subscription_receivable} label="ذمم اشتراكات غير محصلة — ليست نقدًا"/>
 {text(`فروقات لم تراجع: ${data.metrics.unreviewed_differences} · حسابات تحتاج مراجعة لاتجاه الرصيد: ${data.metrics.negative_accounts}`)}
 {text(`اختلافات استلام عهدة: ${data.metrics.cash_receipt_discrepancies} · استثناءات تسعير: ${data.metrics.pricing_exceptions}`)}
 {text('الإيراد المحاسبي لا يثبت وجود نقد؛ لا نجمع النقد والذمم والالتزامات في رصيد واحد.')}
 </>:null}
 <View style={{flexDirection:'row-reverse',flexWrap:'wrap',gap:Spacing.two}}><AppButton design="refined" title="كل الفترات" variant="outline" onPress={()=>{setFrom(null);setPage(0);}}/><AppButton design="refined" title="آخر 30 يومًا" variant="outline" onPress={()=>{setFrom(new Date(Date.now()-30*86400000).toISOString());setPage(0);}}/>
 {view==='ledger'?(['all','in','out'] as const).map(v=><AppButton key={v} design="refined" title={{all:'كل الحركات',in:'داخل',out:'خارج'}[v]} variant={direction===v?'primary':'outline'} onPress={()=>{setDirection(v);setPage(0);}}/>):null}</View>
 {view==='counts'?<>{text('أوقف المناولة النقدية أثناء العد. أي حركة مرحّلة بين البداية والنتيجة ترفض الجرد وتستلزم إلغاء الجلسة وإعادة العد.')}
 {data.open_session?<>{text(`جلسة مفتوحة: ${new Date(data.open_session.at).toLocaleString('ar-SY')}`)}<FinancialAmount amount={data.open_session.cut.balance} label="رصيد نقطة القطع"/>
 {data.open_session.actor_id===actor?<AppButton design="refined" title="تسجيل النقد المعدود" disabled={!data.enabled||!!operation.frozen||operation.busy} onPress={()=>open('count',data.open_session!.id)}/>:text('الجلسة تخص موظفًا آخر؛ يمكن إلغاؤها بسبب موثق ثم بدء جرد جديد.')}
 <AppButton design="refined" title="إلغاء جلسة الجرد بسبب موثق" variant="outline" disabled={!data.enabled||!!operation.frozen||operation.busy} onPress={()=>open('cancel_count',data.open_session!.id)}/></>:<AppButton design="refined" title="بدء جلسة جرد" disabled={!data.enabled||!!operation.frozen||operation.busy} onPress={()=>open('start')}/>}</>:null}
 {data.rows.map(r=><View key={r.id} style={{padding:Spacing.three,gap:Spacing.two,borderRadius:16,borderWidth:1,borderColor:colors.borderStrong,backgroundColor:colors.surface}}>
 {text(names[r.kind]??r.kind)}{text(new Date(r.at).toLocaleString('ar-SY',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))}
 {r.amount!==null?<FinancialAmount amount={r.amount} label={r.side===null?'المبلغ المسجل':r.side==='debit'?'داخل':'خارج'}/>:null}
 {r.balance!==null?<FinancialAmount amount={r.balance} label="الرصيد التراكمي بعد الحركة"/>:null}{r.difference!==null?<FinancialAmount amount={r.difference} label="فرق الجرد — لا تصحيح تلقائي"/>:null}
 {r.reference?<DocumentReference value={r.reference}/>:null}{r.journal_reference?<DocumentReference value={r.journal_reference}/>:null}
 <FinancialStatus label={view==='ledger'?'مرحّلة':r.reviewed?'راجعت الإدارة الفرق — دون تسوية':'سجل رقابي فقط'} tone={view==='ledger'?'success':'info'}/>
 <AppButton design="refined" title="تفاصيل السند / سجل الرقابة" variant="outline" onPress={()=>setSelected(r)}/>
 {view==='differences'&&!r.reviewed&&data.permissions.review?<AppButton design="refined" title="توثيق مراجعة الفرق — دون تصحيح" disabled={!data.enabled||operation.busy||!!operation.frozen} onPress={()=>open('review',r.id)}/>:null}
 </View>)}
 {view!=='dashboard'&&!data.rows.length?text('لا توجد سجلات في هذه الصفحة أو الفترة.'):null}
 {view!=='dashboard'?<><AppButton design="refined" title="السابق" variant="outline" disabled={!page||loading} onPress={()=>setPage(p=>p-1)}/><AppButton design="refined" title="التالي" variant="outline" disabled={!data.has_more||loading} onPress={()=>setPage(p=>p+1)}/></>:null}
 </>:null}
 {!financeKind?<FinancialOperationControls busy={operation.busy} error={operation.error} frozen={!!operation.frozen} result={operation.result} message={msg} onRecover={()=>void operation.run(undefined,true)} onResume={()=>void operation.run()} onFinish={()=>void operation.finish()}/>:null}
 {command?<AppModal design="refined" visible title={names[command]} message="سجل رقابي فقط؛ لا يتم قبض أو صرف أو تصحيح نقد بهذه العملية." confirmText="تأكيد التسجيل" cancelText="إلغاء" busy={operation.busy} onCancel={()=>{if(!operation.busy)setCommand(null);}} onConfirm={()=>void submit()}>
 {command==='count'?<AppTextField design="refined" label="النقد المعدود فعليًا بالليرة السورية" value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/>:null}
 <AppTextField design="refined" label="الوصف والسبب الموثق" value={reason} onChangeText={setReason} multiline/>{inputError?text(inputError):null}
 </AppModal>:null}
 {selected?<AppModal design="refined" visible title="تفاصيل السند أو سجل الرقابة" confirmText="إغلاق" onConfirm={()=>setSelected(null)} onCancel={()=>setSelected(null)}>
 {selected.reference?<DocumentReference value={selected.reference}/>:null}{selected.journal_reference?<DocumentReference value={selected.journal_reference}/>:null}
 {text(`السجل: ${selected.id}`)}{text(`العملية: ${selected.operation_id}`)}{text(`الموظف: ${selected.actor_id??'عملية نظام خادمية'}`)}
 {selected.reason?text(selected.reason):null}{selected.event?text(`حدث المصدر: ${selected.event}`):null}{selected.expense_type?text(`نوع المصروف: ${selected.expense_type}`):null}{selected.source?text(`مصدر الافتتاحي: ${selected.source}`):null}
 {selected.cut?<><FinancialAmount amount={selected.cut.balance} label="رصيد نقطة القطع"/>{text(`Snapshot PostgreSQL: ${selected.cut.snapshot}`)}</>:null}
 {selected.reversal_of?text(`قيد عكسي للأصل: ${selected.reversal_of}`):null}
 {selected.journal_id?<JournalDetails key={`${actor}:${selected.journal_id}`} actor={actor} journal={selected.journal_id}/>:null}
 </AppModal>:null}
 </View></AccountShell>;
}
function JournalDetails({actor,journal}:{actor:string;journal:string}){
 const {colors}=useTheme();const read=useCallback(()=>getTreasury(actor,'ledger',0,null,null,'all',journal),[actor,journal]);
 const {data,error,loading,refresh}=useCustodyRead(`treasury-journal:${actor}:${journal}`,read);
 return <View style={{gap:Spacing.two}}>{loading?<ActivityIndicator color={colors.primary}/>:null}{error?<><Text style={{...Typography.body,color:colors.errorForeground}}>{error}</Text><AppButton design="refined" title="إعادة تحميل القيد" variant="outline" onPress={refresh}/></>:null}
 {data?.details?<><Text style={{...Typography.body,color:colors.text,textAlign:'right'}}>{data.details.reason}</Text>{data.details.lines.map((l,i)=><FinancialAmount key={i} amount={l.amount} label={`${l.side==='debit'?'مدين':'دائن'} · ${l.account}`}/>)}</>:null}</View>;
}
