import {useCallback,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {useTheme} from '@/context/ThemeContext';
import {Typography,Spacing} from '@/constants/theme';
import {AppButton} from '@/components/ui/AppButton';
import {AppTextField} from '@/components/ui/AppTextField';
import {AppModal} from '@/components/ui/AppModal';
import {FinancialAmount} from '@/components/ui/FinancialAmount';
import {DocumentReference} from '@/components/ui/DocumentReference';
import {FinancialStatus} from '@/components/ui/FinancialStatus';
import {FinancialOperationControls} from '@/components/ui/FinancialOperationControls';
import {FinancialDatePicker} from '@/components/merchant/FinancialDatePicker';
import {useCustodyRead} from '@/hooks/useCustodyRead';
import {useFinancialOperation} from '@/hooks/useFinancialOperation';
import {getTreasuryFinance,normalizeTreasuryFinanceInput,treasuryFinanceOperationApi,type TreasuryFinanceInput,type TreasuryFinanceKind,type TreasuryFinanceRow,type TreasuryFinanceStage} from '@/lib/treasury-finance';

const titles={expense:'مصروفات المكتب',adjustment:'تصحيح فروقات الجرد',opening:'السند الافتتاحي'};
const stageLabel:Record<TreasuryFinanceStage,string>={requested:'مطلوب — لم يُرحّل',approved:'معتمد — لم يُصرف',posted:'مرحّل',rejected:'مرفوض'};
const rejection:Record<string,string>={c9_disabled:'التفعيل مغلق.',count_unavailable:'نتيجة الجرد غير متاحة.',correction_exists:'يوجد تصحيح أو طلب غير مرفوض لهذا الفرق.',stale_count:'تحرك النقد بعد الجرد؛ يلزم جرد جديد قبل التصحيح.',invalid_cash_date:'تاريخ النقد لا يجوز أن يكون في المستقبل.',opening_after_movements:'بدأت حركات الخزينة أو صدر الافتتاحي؛ يلزم مسار انتقال مستقل.',invalid_stage:'تغيرت مرحلة الطلب؛ حدّث السجل.',self_approval:'لا يمكن لمقدم الطلب اعتماده.',counter_approval:'لا يمكن لمجري الجرد اعتماد تصحيحه.',opening_disabled_or_unconfirmed:'يلزم فتح إصدار الافتتاحي وتأكيد المالك صراحة.',insufficient_treasury:'رصيد الخزينة غير كافٍ؛ لم يُصرف شيء.'};
export function TreasuryFinanceWorkflow({actor,kind}:{actor:string;kind:TreasuryFinanceKind}){
 const {colors}=useTheme(),[page,setPage]=useState(0),[modal,setModal]=useState<{action:TreasuryFinanceInput['action'];row?:TreasuryFinanceRow;countId?:string}|null>(null);
 const [amount,setAmount]=useState(''),[reason,setReason]=useState(''),[detail,setDetail]=useState(''),[cashDate,setCashDate]=useState(''),[ownerConfirmed,setOwnerConfirmed]=useState(false),[formError,setFormError]=useState('');
 const read=useCallback(()=>getTreasuryFinance(actor,kind,page),[actor,kind,page]);
 const {data,loading,error,refresh}=useCustodyRead(`treasury-finance:${actor}:${kind}:${page}`,read);
 useFocusEffect(useCallback(()=>{const timer=setInterval(refresh,15000);return()=>clearInterval(timer);},[refresh]));
 const op=useFinancialOperation(actor,'office',refresh,treasuryFinanceOperationApi);
 const text=(s:string)=> <Text style={{...Typography.body,color:colors.text,textAlign:'right'}}>{s}</Text>;
 const open=(action:TreasuryFinanceInput['action'],row?:TreasuryFinanceRow,countId?:string)=>{setModal({action,row,countId});setReason('');setAmount('');setDetail('');setCashDate('');setOwnerConfirmed(false);setFormError('');};
 const submit=async()=>{if(!modal||op.busy)return;try{let input:TreasuryFinanceInput;
  if(modal.action==='request')input=kind==='expense'?{action:'request',kind,reason,amount,expenseType:detail}:kind==='opening'?{action:'request',kind,reason,amount,source:detail,cashDate}:{action:'request',kind,reason,countId:modal.countId??''};
  else input={action:modal.action,kind,reason,requestId:modal.row!.id,ownerConfirmed};
  input=normalizeTreasuryFinanceInput(input);setModal(null);setFormError('');await op.run(input);
 }catch(cause){setFormError(cause instanceof Error?cause.message:'تعذر تجهيز العملية.');}};
 const blocked=op.busy||!!op.frozen||!data?.enabled;
 const message=op.result?.state==='completed'?`حُفظت العملية: ${stageLabel[op.result.stage]}. ${op.result.posted?'رُحّل القيد المتوازن.':'لم يتغير نقد الخزينة.'}`:op.result?.state==='rejected'?(rejection[op.result.code]??'رُفضت العملية؛ حدّث السجل.'):'النتيجة غير محسومة؛ استعد المحاولة نفسها قبل إجراء مستقل.';
 return <View style={{gap:Spacing.three}}>
 {text(titles[kind])}<AppButton design="refined" title="تحديث الطلبات والسندات" variant="outline" onPress={refresh}/>
 {loading?<ActivityIndicator color={colors.primary}/>:null}{error?<Text accessibilityRole="alert" style={{...Typography.body,color:colors.errorForeground,textAlign:'right'}}>{error}</Text>:null}
 {data?<>
 {!data.enabled?<FinancialStatus label="C9 مغلق افتراضيًا" tone="warning"/>:null}
 {data.treasuryBalance!==null?<FinancialAmount amount={data.treasuryBalance} label="نقد الخزينة المرحّل"/>:null}
 {kind==='expense'?<>{text('الطلب لا يصرف نقدًا. يحتاج اعتماد موظف مفوض آخر، ثم تأكيد الصرف الفعلي بصلاحية مستقلة.')}<AppButton design="refined" title="طلب مصروف نقدي" disabled={blocked||!data.permissions.request} onPress={()=>open('request')}/></>:null}
 {kind==='opening'?<>{text('لا يوجد رصيد مفترض أو استيراد من النظام القديم. يلزم مصدر النقد وتاريخه، واعتماد المالك بحساب مختلف عن مقدم الطلب. لا يصدر الافتتاحي بعد بدء حركات الخزينة.')}
 {!data.openingEnabled?<FinancialStatus label="إصدار الافتتاحي مغلق؛ يمكن إعداد الطلب فقط" tone="warning"/>:null}<AppButton design="refined" title="طلب سند افتتاحي موثق" disabled={blocked||!data.permissions.request} onPress={()=>open('request')}/></>:null}
 {kind==='adjustment'?<>{text('فرق الجرد ليس ذمة على الموظف. اعتماده يرحّل التصحيح فقط بعد تحقق نقطة القطع وبواسطة موظف غير مجري الجرد ومقدم الطلب.')}
 {data.counts.map(c=><View key={c.id} style={{padding:Spacing.three,gap:Spacing.two,borderWidth:1,borderColor:colors.borderStrong,borderRadius:16}}>
 {text(`جرد ${new Date(c.at).toLocaleString('ar-SY')}`)}<FinancialAmount amount={c.book} label="الرصيد الدفتري عند القطع"/><FinancialAmount amount={c.counted} label="المعدود"/><FinancialAmount amount={c.difference} label="الفرق"/>
 <FinancialStatus label={c.eligible?'متاح لطلب التصحيح':'يحتاج جردًا جديدًا أو له طلب قائم'} tone={c.eligible?'info':'warning'}/><AppButton design="refined" title="طلب تصحيح هذا الفرق" disabled={blocked||!data.permissions.request||!c.eligible} onPress={()=>open('request',undefined,c.id)}/></View>)}
 {!data.counts.length?text('لا توجد فروقات جرد في هذه الصفحة.'):null}</>:null}
 {data.rows.map(row=><View key={row.id} style={{padding:Spacing.three,gap:Spacing.two,borderWidth:1,borderColor:colors.borderStrong,borderRadius:16,backgroundColor:colors.surface}}>
 <FinancialStatus label={stageLabel[row.stage]} tone={row.stage==='posted'?'success':row.stage==='rejected'?'error':'info'}/><FinancialAmount amount={row.amount} label="مبلغ السند"/>
 {row.cashDelta!==null?<FinancialAmount amount={row.cashDelta} label="الأثر النقدي المرحّل"/>:null}{text(row.reason)}{text(`طلبه: ${row.requestedBy} · ${new Date(row.at).toLocaleString('ar-SY')}`)}
 {row.difference!==null?<FinancialAmount amount={row.difference} label="فرق الجرد المثبت — سالب للنقص وموجب للزيادة"/>:null}{row.book!==null?<FinancialAmount amount={row.book} label="الدفتري عند الجرد"/>:null}{row.counted!==null?<FinancialAmount amount={row.counted} label="النقد المعدود"/>:null}
 {kind==='adjustment'&&row.stage==='requested'&&row.cutCurrent===false?<FinancialStatus label="تحرك النقد؛ يلزم رفض الطلب وإعادة الجرد" tone="warning"/>:null}
 {row.expenseType?text(`نوع المصروف: ${row.expenseType}`):null}{row.source?text(`المصدر: ${row.source}`):null}{row.cashDate?text(`تاريخ النقد: ${row.cashDate}`):null}
 {row.reference?<DocumentReference value={row.reference}/>:null}
 {row.events.map((e,i)=><View key={i}>{text(`${stageLabel[e.action]} · ${new Date(e.at).toLocaleString('ar-SY')} · الموظف: ${e.actorId}`)}{text(e.reason)}</View>)}
 {row.stage==='requested'&&data.permissions.approve?<><AppButton design="refined" title={kind==='expense'?'اعتماد المصروف — دون صرف':kind==='opening'?'اعتماد المالك وترحيل الافتتاحي':'اعتماد التصحيح وترحيل ADJ'} disabled={blocked||row.requestedBy===actor||kind==='adjustment'&&(row.countActor===actor||row.cutCurrent===false)||kind==='opening'&&!data.openingEnabled} onPress={()=>open('approve',row)}/>
 {row.requestedBy===actor||kind==='adjustment'&&row.countActor===actor?text('الاعتماد يحتاج موظفًا آخر مخولًا.'):null}<AppButton design="refined" title="رفض الطلب بسبب موثق" variant="outline" disabled={blocked} onPress={()=>open('reject',row)}/></>:null}
 {kind==='expense'&&row.stage==='approved'&&data.permissions.pay?<AppButton design="refined" title="تأكيد صرف النقد فعليًا" disabled={blocked||data.treasuryBalance===null} onPress={()=>open('pay',row)}/>:null}
 </View>)}
 {!data.rows.length?text('لا توجد طلبات مالية في هذه الصفحة.'):null}
 <AppButton design="refined" title="السابق" variant="outline" disabled={!page||loading||op.busy} onPress={()=>setPage(p=>p-1)}/><AppButton design="refined" title="التالي" variant="outline" disabled={loading||op.busy||!data.hasMore&&data.counts.length<20} onPress={()=>setPage(p=>p+1)}/>
 </>:null}
 {op.frozen&&op.frozen.kind!==kind?text('المحاولة المحفوظة تخص قسمًا ماليًا آخر؛ استعد نتيجتها قبل بدء عملية مستقلة.'):null}
 <FinancialOperationControls busy={op.busy} error={op.error} frozen={!!op.frozen} result={op.result} message={message} onRecover={()=>void op.run(undefined,true)} onResume={()=>void op.run()} onFinish={()=>void op.finish()}/>
 {modal?<AppModal design="refined" visible title={modal.action==='request'?'طلب موثق':modal.action==='pay'?'تأكيد الصرف الفعلي':modal.action==='approve'?'اعتماد مالي مستقل':'رفض الطلب'} message={modal.action==='pay'?'أكد فقط بعد تسليم النقد فعليًا. الاعتماد السابق وحده لا يثبت الصرف.':modal.action==='approve'&&kind!=='expense'?'سيُرحّل القيد المتوازن في معاملة الاعتماد نفسها.':'السبب مطلوب ويُحفظ في سجل التدقيق.'} confirmText="تأكيد" cancelText="إلغاء" busy={op.busy} onCancel={()=>{if(!op.busy)setModal(null);}} onConfirm={()=>void submit()}>
 {modal.row?<FinancialAmount amount={modal.row.amount} label="المبلغ المثبت في الطلب"/>:null}
 {modal.action==='request'&&kind!=='adjustment'?<><AppTextField design="refined" label="المبلغ الفعلي بالليرة السورية" value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/><AppTextField design="refined" label={kind==='expense'?'نوع مصروف التشغيل':'مصدر النقد الافتتاحي'} value={detail} onChangeText={setDetail}/></>:null}
 {modal.action==='request'&&kind==='opening'?<FinancialDatePicker title="تاريخ النقد الموثق" value={cashDate} onChange={setCashDate}/>:null}
 {modal.action==='approve'&&kind==='opening'?<AppButton design="refined" title={ownerConfirmed?'أؤكد بصفتي المالك اعتماد هذا الرصيد الافتتاحي':'اضغط لتأكيد موافقة المالك الصريحة'} variant={ownerConfirmed?'primary':'outline'} onPress={()=>setOwnerConfirmed(v=>!v)}/>:null}
 <AppTextField design="refined" label="السبب الموثق" value={reason} onChangeText={setReason} multiline/>{formError?<Text style={{...Typography.body,color:colors.errorForeground}}>{formError}</Text>:null}
 </AppModal>:null}
 </View>;
}
