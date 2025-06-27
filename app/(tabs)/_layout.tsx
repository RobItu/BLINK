import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Tabs } from "expo-router";
import React from "react";


export default function TabLayout() {
	const colorScheme = useColorScheme();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
				headerShown: false,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Connect",
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							name={focused ? "wallet" : "wallet-outline"}
							color={color}
						/>
					),
				}}
			/>
			{/* <Tabs.Screen
    name="generate-qr"
    options={{
        title: "Generate QR",
        tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
                name={focused ? "qr-code" : "qr-code-outline"}
                color={color}
            />
        ),
    }} */}
{/* /> */}
<Tabs.Screen
    name="scan-qr"
    options={{
        title: "Scan QR",
        tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
                name={focused ? "scan" : "scan-outline"}
                color={color}
            />
        ),
    }}
/>
			<Tabs.Screen
				name="TX History"
				options={{
					title: "TX History",
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							name={focused ? "reader" : "reader-outline"}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="Smart Swap"
				options={{
					title: "Smart Swap",
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							name={focused ? "code-slash" : "code-slash-outline"}
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="Solana"
				options={{
					title: "Solana",
					tabBarIcon: ({ color, focused }) => (
						<TabBarIcon
							name={focused ? "swap-horizontal" : "swap-horizontal-outline"}
							color={color}
						/>
					),
				}}
			/>
		</Tabs>
	);
}
