/**
 * Platform utilities — canonical platform definitions for social media,
 * content distribution, and analytics platforms.
 *
 * This module provides:
 * - Platform metadata (names, icons, colors)
 * - PlatformBadge component for consistent platform display
 * - Platform validation and normalization
 */

import React from 'react';

export interface Platform {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'social' | 'messaging' | 'analytics' | 'advertising' | 'other';
}

export const PLATFORMS: Record<string, Platform> = {
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    color: '#1877f2',
    category: 'social',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    icon: '📷',
    color: '#e4405f',
    category: 'social',
  },
  x_twitter: {
    id: 'x_twitter',
    name: 'X (Twitter)',
    icon: '🐦',
    color: '#000000',
    category: 'social',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    color: '#000000',
    category: 'social',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    color: '#0a66c2',
    category: 'social',
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    icon: '📌',
    color: '#e60023',
    category: 'social',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶️',
    color: '#ff0000',
    category: 'social',
  },
  email: {
    id: 'email',
    name: 'Email',
    icon: '📧',
    color: '#f97316',
    category: 'messaging',
  },
  google_business: {
    id: 'google_business',
    name: 'Google Business',
    icon: '🔍',
    color: '#4285f4',
    category: 'analytics',
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '💬',
    color: '#25d366',
    category: 'messaging',
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    color: '#0088cc',
    category: 'messaging',
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    icon: '🤖',
    color: '#ff4500',
    category: 'social',
  },
  snapchat: {
    id: 'snapchat',
    name: 'Snapchat',
    icon: '👻',
    color: '#fffc00',
    category: 'social',
  },
};

export function getPlatform(platformId: string): Platform | null {
  return PLATFORMS[platformId] || null;
}

export function getPlatformName(platformId: string): string {
  return PLATFORMS[platformId]?.name || platformId;
}

export function getPlatformIcon(platformId: string): string {
  return PLATFORMS[platformId]?.icon || '🌐';
}

export function getPlatformColor(platformId: string): string {
  return PLATFORMS[platformId]?.color || '#6b7280';
}

export function isValidPlatform(platformId: string): boolean {
  return platformId in PLATFORMS;
}

export function getPlatformsByCategory(category: Platform['category']): Platform[] {
  return Object.values(PLATFORMS).filter((p) => p.category === category);
}

export function getAllPlatforms(): Platform[] {
  return Object.values(PLATFORMS);
}

/**
 * PlatformBadge component props
 */
export interface PlatformBadgeProps {
  platform: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

/**
 * PlatformBadge — displays a platform with icon and optional name.
 * This is a simple component that can be used in React components.
 */
export function PlatformBadge({ platform, size = 'md', showName = false }: PlatformBadgeProps): React.ReactElement {
  const platformData = getPlatform(platform);
  const icon = platformData?.icon || '🌐';
  const name = platformData?.name || platform;
  const color = platformData?.color || '#6b7280';

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return React.createElement(
    'span',
    {
      className: `inline-flex items-center gap-1 rounded-md font-medium ${sizeClasses[size]}`,
      style: {
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
      },
    },
    React.createElement('span', { className: 'text-base' }, icon),
    showName && React.createElement('span', null, name)
  );
}
