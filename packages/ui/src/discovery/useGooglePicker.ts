"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal type declarations for Google Picker API (loaded via script tag)
declare global {
  interface Window {
    gapi: {
      load: (lib: string, callback: () => void) => void;
    };
    google: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        DocsView: new () => GoogleDocsView;
        Feature: { MULTISELECT_ENABLED: string };
        Action: { PICKED: string; CANCEL: string };
      };
    };
  }
}

interface GooglePickerBuilder {
  setAppId(id: string): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  addView(view: GoogleDocsView): GooglePickerBuilder;
  enableFeature(feature: string): GooglePickerBuilder;
  setMaxItems(max: number): GooglePickerBuilder;
  setCallback(fn: (data: GooglePickerData) => void): GooglePickerBuilder;
  build(): { setVisible(v: boolean): void };
}

interface GoogleDocsView {
  setIncludeFolders(v: boolean): GoogleDocsView;
  setSelectFolderEnabled(v: boolean): GoogleDocsView;
  setEnableDrives(v: boolean): GoogleDocsView;
  setMimeTypes(types: string): GoogleDocsView;
}

interface GooglePickerData {
  action: string;
  docs?: GooglePickerDoc[];
}

interface GooglePickerDoc {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  url?: string;
  lastEditedUtc?: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  webViewLink?: string;
  modifiedTime?: string;
}

export type GooglePickerState = "idle" | "loading_sdk" | "ready" | "error";

const MAX_PICKER_FILES = 10;

// MIME types supported by Foundry's Drive import backend
const SUPPORTED_MIME_TYPES = [
  // Google native formats (auto-exported server-side)
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  // Office formats
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Text formats
  "text/plain",
  "text/csv",
  "application/csv",
  "text/markdown",
  "text/x-markdown",
].join(",");

export function useGooglePicker({
  apiKey,
  clientId,
  onFilesSelected,
}: {
  apiKey: string;
  clientId: string;
  onFilesSelected: (files: DriveFile[]) => void;
}): {
  pickerState: GooglePickerState;
  sdkError: string | null;
  openPicker: (accessToken: string) => void;
} {
  const [pickerState, setPickerState] = useState<GooglePickerState>("idle");
  const [sdkError, setSdkError] = useState<string | null>(null);
  const gapiLoadedRef = useRef(false);
  const onFilesSelectedRef = useRef(onFilesSelected);
  onFilesSelectedRef.current = onFilesSelected;

  useEffect(() => {
    if (typeof window === "undefined" || gapiLoadedRef.current) return;

    // gapi already loaded (e.g. multiple hook instances on same page)
    if (typeof window.gapi !== "undefined") {
      gapiLoadedRef.current = true;
      window.gapi.load("picker", () => setPickerState("ready"));
      return;
    }

    setPickerState("loading_sdk");

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gapiLoadedRef.current = true;
      window.gapi.load("picker", () => setPickerState("ready"));
    };
    script.onerror = () => {
      setPickerState("error");
      setSdkError("Google Picker unavailable — use file upload instead");
    };
    document.head.appendChild(script);
  }, []);

  const openPicker = useCallback(
    (accessToken: string) => {
      if (typeof window.google === "undefined" || !window.google.picker) {
        setSdkError("Google Picker unavailable — use file upload instead");
        return;
      }

      const myDriveView = new window.google.picker.DocsView()
        .setMimeTypes(SUPPORTED_MIME_TYPES)
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false);

      const sharedDriveView = new window.google.picker.DocsView()
        .setMimeTypes(SUPPORTED_MIME_TYPES)
        .setIncludeFolders(false)
        .setEnableDrives(true);

      const picker = new window.google.picker.PickerBuilder()
        .setAppId(clientId)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .addView(myDriveView)
        .addView(sharedDriveView)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setMaxItems(MAX_PICKER_FILES)
        .setCallback((data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const files: DriveFile[] = (data.docs ?? []).map((doc) => ({
              id: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              sizeBytes: doc.sizeBytes,
              webViewLink: doc.url,
              modifiedTime: doc.lastEditedUtc
                ? new Date(doc.lastEditedUtc).toISOString()
                : undefined,
            }));
            onFilesSelectedRef.current(files);
          }
        })
        .build();

      picker.setVisible(true);
    },
    [apiKey, clientId],
  );

  return { pickerState, sdkError, openPicker };
}
