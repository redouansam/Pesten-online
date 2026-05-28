import { Image, Pressable, Text, View } from "react-native";
import type { ImageSourcePropType, StyleProp, ViewStyle } from "react-native";
import type { ReactNode } from "react";

import { coinImage, gemImage } from "../currencyImages";
import { styles } from "../styles";

type PlayerHeaderProps = {
  avatarBackgroundColor: string;
  avatarFrameColor: string;
  avatarLabel: string;
  avatarTextColor: string;
  gems: number;
  coins: number;
  level: number;
  name: string;
  onCurrencyPress: () => void;
  onProfilePress: () => void;
  xpPercent: number;
};

type CurrencyPillProps = {
  kind?: "coins" | "gems";
  onPress: () => void;
  source: ImageSourcePropType;
  value: number;
};

type GameModeCardProps = {
  active?: boolean;
  badge?: string;
  disabled?: boolean;
  icon: string;
  tone?: "gold" | "blue" | "purple";
  onPress: () => void;
  subtitle: string;
  title: string;
};

type SurfaceCardProps = {
  children: ReactNode;
  subdued?: boolean;
  style?: StyleProp<ViewStyle>;
};

type SectionHeaderProps = {
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
  title: string;
};

type GameButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  subLabel?: string;
  tone?: "primary" | "secondary" | "danger";
};

type GameModalFrameProps = {
  children: ReactNode;
  eyebrow?: string;
  frameStyle?: StyleProp<ViewStyle>;
  onClose?: () => void;
  text?: string;
  title: string;
  variant?: "light" | "dark";
};

export type BottomNavKey = "shop" | "social" | "play" | "rules" | "profile";

type BottomNavProps = {
  active: BottomNavKey;
  onProfile: () => void;
  onRules: () => void;
  onShop: () => void;
  onSocial: () => void;
  onPlay: () => void;
  shopBadge?: boolean;
  socialBadge?: boolean;
};

export function PlayerHeader({
  avatarBackgroundColor,
  avatarFrameColor,
  avatarLabel,
  avatarTextColor,
  coins,
  gems,
  level,
  name,
  onCurrencyPress,
  onProfilePress,
  xpPercent,
}: PlayerHeaderProps) {
  return (
    <View style={styles.gameHomeTopBar}>
      <Pressable style={styles.gamePlayerButton} onPress={onProfilePress}>
        <View
          style={[
            styles.gamePlayerAvatar,
            {
              backgroundColor: avatarBackgroundColor,
              borderColor: avatarFrameColor,
              shadowColor: avatarFrameColor,
            },
          ]}
        >
          <Text
            style={[
              styles.gamePlayerAvatarText,
              {
                color: avatarTextColor,
              },
            ]}
          >
            {avatarLabel}
          </Text>
        </View>

        <View style={styles.gamePlayerCopy}>
          <Text style={styles.gamePlayerName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.gamePlayerMetaRow}>
            <Text style={styles.gamePlayerLevel}>Lv {level}</Text>
            <View style={styles.gamePlayerXpTrack}>
              <View
                style={[
                  styles.gamePlayerXpFill,
                  {
                    width: `${xpPercent}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </Pressable>

      <View style={styles.gameResourceStack}>
        <CurrencyPill
          kind="coins"
          source={coinImage}
          value={coins}
          onPress={onCurrencyPress}
        />
        <CurrencyPill
          kind="gems"
          source={gemImage}
          value={gems}
          onPress={onCurrencyPress}
        />
      </View>
    </View>
  );
}

export function CurrencyPill({
  kind = "coins",
  onPress,
  source,
  value,
}: CurrencyPillProps) {
  return (
    <Pressable
      style={[
        styles.gameCurrencyPill,
        kind === "gems" && styles.gameCurrencyPillGem,
      ]}
      onPress={onPress}
    >
      <Image source={source} style={styles.gameCurrencyIcon} />
      <Text style={styles.gameCurrencyValue}>{value}</Text>
      <View style={styles.gameCurrencyPlus}>
        <Text style={styles.gameCurrencyPlusText}>+</Text>
      </View>
    </Pressable>
  );
}

export function GameModeCard({
  active,
  badge,
  disabled,
  icon,
  tone = "gold",
  onPress,
  subtitle,
  title,
}: GameModeCardProps) {
  return (
    <Pressable
      style={[
        styles.gameModeMiniCard,
        active && styles.gameModeMiniCardActive,
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {badge ? (
        <View
          style={
            badge.length <= 2
              ? styles.gameModeMiniBadgeRed
              : styles.gameModeMiniBadge
          }
        >
          <Text style={styles.gameModeMiniBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <View
        style={[
          styles.gameModeMiniIcon,
          tone === "blue" && styles.gameModeMiniIconBlue,
          tone === "purple" && styles.gameModeMiniIconPurple,
        ]}
      >
        <Text style={styles.gameModeMiniIconText}>{icon}</Text>
      </View>
      <View style={styles.gameModeMiniCopy}>
        <Text style={styles.gameModeMiniTitle}>{title}</Text>
        <Text style={styles.gameModeMiniText}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

export function SurfaceCard({ children, subdued, style }: SurfaceCardProps) {
  return (
    <View
      style={[styles.surfaceCard, subdued && styles.surfaceCardSubdued, style]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({
  actionLabel,
  onAction,
  subtitle,
  title,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Pressable style={styles.sectionAction} onPress={onAction}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function GameButton({
  disabled,
  label,
  onPress,
  subLabel,
  tone = "primary",
}: GameButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.gameActionButton,
        tone === "secondary" && styles.gameActionButtonSecondary,
        tone === "danger" && styles.gameActionButtonDanger,
        pressed && !disabled && styles.gameActionButtonPressed,
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.gameActionButtonText,
          tone === "secondary" && styles.gameActionButtonTextDark,
        ]}
      >
        {label}
      </Text>
      {subLabel ? (
        <Text
          style={[
            styles.gameActionButtonSubText,
            tone === "secondary" && styles.gameActionButtonSubTextDark,
          ]}
        >
          {subLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function GameModalFrame({
  children,
  eyebrow,
  frameStyle,
  onClose,
  text,
  title,
  variant = "light",
}: GameModalFrameProps) {
  const isDark = variant === "dark";

  return (
    <View
      style={[
        styles.gameModalFrame,
        isDark && styles.gameModalFrameDark,
        frameStyle,
      ]}
    >
      <View style={styles.gameModalHeader}>
        <View style={styles.gameModalTitleBlock}>
          {eyebrow ? (
            <Text
              style={[
                styles.gameModalEyebrow,
                isDark && styles.gameModalEyebrowDark,
              ]}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text
            style={[styles.gameModalTitle, isDark && styles.gameModalTitleDark]}
          >
            {title}
          </Text>
          {text ? (
            <Text
              style={[styles.gameModalText, isDark && styles.gameModalTextDark]}
            >
              {text}
            </Text>
          ) : null}
        </View>

        {onClose ? (
          <Pressable
            style={[
              styles.gameModalCloseButton,
              isDark && styles.gameModalCloseButtonDark,
            ]}
            onPress={onClose}
          >
            <Text
              style={[
                styles.gameModalCloseText,
                isDark && styles.gameModalCloseTextDark,
              ]}
            >
              Sluit
            </Text>
          </Pressable>
        ) : null}
      </View>

      {children}
    </View>
  );
}

export function BottomNav({
  active,
  onProfile,
  onRules,
  onShop,
  onSocial,
  onPlay,
  shopBadge,
  socialBadge,
}: BottomNavProps) {
  const items: Array<{
    key: BottomNavKey;
    label: string;
    icon: string;
    onPress: () => void;
    badge?: boolean;
  }> = [
    { key: "shop", label: "Shop", icon: "$", onPress: onShop, badge: shopBadge },
    {
      key: "social",
      label: "Sociaal",
      icon: "+",
      onPress: onSocial,
      badge: socialBadge,
    },
    { key: "play", label: "Speel", icon: "P", onPress: onPlay },
    { key: "rules", label: "Regels", icon: "?", onPress: onRules },
    { key: "profile", label: "Profiel", icon: "S", onPress: onProfile },
  ];

  return (
    <View style={styles.gameBottomNav}>
      {items.map((item) => {
        const isActive = item.key === active;

        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={[
              styles.gameBottomNavItem,
              isActive && styles.gameBottomNavItemActive,
            ]}
            onPress={item.onPress}
          >
            {item.badge ? <View style={styles.gameNavBadgeTiny} /> : null}
            <Text
              style={[
                styles.gameBottomNavIcon,
                isActive && styles.gameBottomNavIconActive,
              ]}
            >
              {item.icon}
            </Text>
            <Text
              style={
                isActive
                  ? styles.gameBottomNavTextActive
                  : styles.gameBottomNavText
              }
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
