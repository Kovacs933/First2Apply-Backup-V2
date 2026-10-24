import { config as loadEnvVars } from 'dotenv';

import { MakerAppX } from '@electron-forge/maker-appx';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerFlatpak } from '@electron-forge/maker-flatpak';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import type { ForgeConfig } from '@electron-forge/shared-types';
import path from 'path';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

// load env vars
loadEnvVars({ path: path.join(__dirname, '..', 'desktopProbe', '.env') });

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'packagers', 'icons', 'foundation'),
    executableName: 'Foundation',
    // shown in the exe's file details and used for the Start menu folder
    win32metadata: {
      CompanyName: 'Foundation',
      ProductName: 'Foundation',
      FileDescription: 'Foundation',
    },
    appBundleId: process.env.APP_BUNDLE_ID,
    protocols: [
      {
        name: 'Foundation',
        schemes: ['foundation'],
      },
    ],
    osxSign: {},
    osxNotarize: {
      appleId: process.env.APPLE_ID ?? '',
      appleIdPassword: process.env.APPLE_PASSWORD ?? '',
      teamId: process.env.APPLE_TEAM_ID ?? '',
    },
  },
  rebuildConfig: {},
  makers: [
    // Windows installer: out/make/squirrel.windows/x64/FoundationSetup.exe
    new MakerSquirrel({
      authors: 'Foundation',
      name: 'foundation',
      exe: 'Foundation.exe',
      setupExe: 'FoundationSetup.exe',
      setupIcon: path.join(__dirname, 'packagers', 'icons', 'foundation.ico'),
      noMsi: true,
    }),
    new MakerDMG({
      format: 'ULFO',
      background: path.join(__dirname, 'packagers', 'macos-dmg-background.png'),
      additionalDMGOptions: {
        window: {
          size: {
            width: 658,
            height: 498,
          },
        },
      },
    }),
    new MakerAppX({
      packageName: 'BeastXIndustries.First2Apply',
      publisher: 'CN=A2CA7EBA-28F4-4422-B08E-763EC4EEEACE',
      makeVersionWinStoreCompatible: true,
      // @ts-expect-error - Property doesn't exist on type definition but is valid
      publisherDisplayName: 'BeastX Industries',
      assets: './packagers/appx/icons',
      manifest: './packagers/appx/AppXManifest.xml',
      // Use development certificate
      devCert: path.join(__dirname, 'packagers', 'appx', 'devcert.pfx'),
      certPass: 'first2apply',
    }),
    new MakerDeb({
      options: {
        name: 'foundation',
        bin: 'Foundation',
        icon: path.join(__dirname, 'packagers', 'icons', 'foundation.png'),
        mimeType: ['x-scheme-handler/foundation'],
      },
    }),
    new MakerRpm({
      options: {
        name: 'foundation',
        bin: 'Foundation',
        icon: path.join(__dirname, 'packagers', 'icons', 'foundation.png'),
        mimeType: ['x-scheme-handler/foundation'],
      },
    }),
    new MakerFlatpak({
      options: {
        id: process.env.APP_BUNDLE_ID,
        productName: 'Foundation',
        genericName: 'Job Search',
        icon: path.join(__dirname, 'packagers', 'icons', 'foundation.png'),
        categories: ['Utility'],
        mimeType: ['x-scheme-handler/foundation'],
        files: [],
      },
    }),
    {
      name: '@electron-forge/maker-zip',
      config: (arch: string) => ({
        // mac auto-updates read the release manifest from the same place as UPDATE_FEED_URL
        macUpdateManifestBaseUrl: process.env.UPDATE_FEED_URL
          ? `${process.env.UPDATE_FEED_URL.replace(/\/$/, '')}/darwin/${arch}`
          : undefined,
      }),
    },
  ],
  // no publishers: the S3 bucket inherited from First 2 Apply belonged to that project.
  // Upload FoundationSetup.exe to your website instead (see launcher/build-installer.ps1).
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      devContentSecurityPolicy: `default-src * self blob: data: gap:; style-src * self 'unsafe-inline' blob: data: gap:; script-src * 'self' 'unsafe-eval' 'unsafe-inline' blob: data: gap:; object-src * 'self' blob: data: gap:; img-src * self 'unsafe-inline' blob: data: gap:; connect-src self * 'unsafe-inline' blob: data: gap:; frame-src * self blob: data: gap:;`,
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
      port: 3049,
    }),
  ],
};

export default config;
