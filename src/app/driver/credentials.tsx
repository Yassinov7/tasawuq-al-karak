import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AccountShell } from "@/components/account/AccountShell";
import { DriverProfessionalInfo } from "@/components/account/DriverProfessionalInfo";
import { AppHeader } from "@/components/navigation/AppHeader";
import { MaxContentWidth } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

export default function DriverCredentialsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/driver/account");
  };
  return <AccountShell safeBottom header={<AppHeader title="بيانات الاعتماد" showBack showNotifications={false} mode="business" onBack={goBack} />}>
    <View style={styles.content}>
      <DriverProfessionalInfo key={user?.id ?? "guest"} />
    </View>
  </AccountShell>;
}

const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center" },
});
