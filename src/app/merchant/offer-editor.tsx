import{useLocalSearchParams}from'expo-router';
import{useAuth}from'@/context/AuthContext';
import{MerchantOfferEditor}from'@/components/merchant/MerchantOfferEditor';
export default function MerchantOfferEditorScreen(){
 const{id}=useLocalSearchParams<{id?:string}>(),{user}=useAuth();const offerId=(Array.isArray(id)?id[0]:id)||null;
 return user?<MerchantOfferEditor key={`${user.id}:${offerId??'new'}`} ownerId={user.id} offerId={offerId}/>:null;
}
