import { Tabs } from "expo-router";

export default function CustomerTabs() {
  return (
    <Tabs initialRouteName="home/index" backBehavior="history" tabBar={() => null}
      screenOptions={{ headerShown: false, popToTopOnBlur: false }}>
      <Tabs.Screen name="home/index" />
      <Tabs.Screen name="stores" />
      <Tabs.Screen name="home/offers" />
      <Tabs.Screen name="home/account" />
    </Tabs>
  );
}
