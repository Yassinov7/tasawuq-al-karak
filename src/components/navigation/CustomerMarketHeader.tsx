import { Stack } from "expo-router";
import Head from "expo-router/head";
import type { ComponentProps } from "react";

import { AppHeader } from "@/components/navigation/AppHeader";

type Props = Omit<ComponentProps<typeof AppHeader>, "adaptiveTitle"> & { title: string; screenTitle?: string };

export function CustomerMarketHeader({ screenTitle, ...props }: Props) {
  const title = screenTitle ?? props.title;
  return <>
    <Stack.Screen options={{ title }} />
    <Head><title>{title}</title></Head>
    <AppHeader {...props} adaptiveTitle />
  </>;
}
