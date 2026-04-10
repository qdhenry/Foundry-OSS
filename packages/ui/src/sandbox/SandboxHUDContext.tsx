"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";

export interface HUDTab {
  sessionId: string;
  taskId: string;
  programSlug: string;
  taskTitle: string;
  status: string;
  setupProgress?: unknown;
  runtimeMode?: string | null;
  subTab: "logs" | "terminal" | "files" | "editor" | "audit" | "chat";
}

export interface WorkspaceCustomizationDotfile {
  path: string;
  content: string;
}

export interface WorkspaceCustomizationShellAlias {
  name: string;
  command: string;
}

export interface WorkspaceCustomizationDevToolConfig {
  tool: string;
  config: string;
}

export interface WorkspaceCustomizationSetupScript {
  name: string;
  script: string;
  runOrder: number;
}

export interface WorkspaceCustomizationPayload {
  dotfiles?: WorkspaceCustomizationDotfile[];
  shellAliases?: WorkspaceCustomizationShellAlias[];
  devToolConfigs?: WorkspaceCustomizationDevToolConfig[];
  setupScripts?: WorkspaceCustomizationSetupScript[];
}

export interface HUDConfigContext {
  taskId: string;
  programId: string;
  programSlug: string;
  task: any;
  subtaskId?: string;
  subtaskTitle?: string;
  subtaskPrompt?: string;
  subtaskIds?: string[];
  mode?: string;
  sandboxPresets?: unknown[];
  defaultPresetId?: string;
  sandboxDefaults?: {
    editorType?: "monaco" | "codemirror" | "none";
    ttlMinutes?: number;
    authProvider?: "anthropic" | "bedrock" | "vertex" | "azure";
    mcpServerOverrides?: string[];
    workspaceCustomization?: WorkspaceCustomizationPayload;
  };
  availableMcpServers?: unknown[];
}

export interface LocalLaunchArgs {
  taskId: string;
  programId: string;
  repositoryId?: string;
  taskPrompt: string;
  skillId?: string;
  model?: string;
  editorType?: "monaco" | "codemirror" | "none";
  ttlMinutes?: number;
  authProvider?: "anthropic" | "bedrock" | "vertex" | "azure";
  presetId?: string;
  mcpServerOverrides?: string[];
  workspaceCustomization?: WorkspaceCustomizationPayload;
  subtaskId?: string;
  subtaskIds?: string[];
  mode?: string;
}

export interface LocalLaunchResult {
  sessionId: string;
}

export type LocalLaunchHandler = (args: LocalLaunchArgs) => Promise<LocalLaunchResult>;

export interface HUDContextType {
  tabs: HUDTab[];
  activeTabId: string | null;
  isExpanded: boolean;
  isConfigPanelOpen: boolean;
  configPanelContext: HUDConfigContext | null;
  localLaunchHandler?: LocalLaunchHandler;
  openTab: (tab: Omit<HUDTab, "subTab">) => void;
  closeTab: (sessionId: string) => void;
  focusTab: (sessionId: string) => void;
  setSubTab: (subTab: HUDTab["subTab"]) => void;
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  openConfig: (context: HUDConfigContext) => void;
  closeConfig: () => void;
}

interface HUDState {
  tabs: HUDTab[];
  activeTabId: string | null;
  isExpanded: boolean;
  isConfigPanelOpen: boolean;
  configPanelContext: HUDConfigContext | null;
}

type HUDAction =
  | { type: "OPEN_TAB"; tab: Omit<HUDTab, "subTab"> }
  | { type: "CLOSE_TAB"; sessionId: string }
  | { type: "FOCUS_TAB"; sessionId: string }
  | { type: "SET_SUB_TAB"; subTab: HUDTab["subTab"] }
  | { type: "TOGGLE_EXPANDED" }
  | { type: "SET_EXPANDED"; expanded: boolean }
  | { type: "OPEN_CONFIG"; context: HUDConfigContext }
  | { type: "CLOSE_CONFIG" };

const initialState: HUDState = {
  tabs: [],
  activeTabId: null,
  isExpanded: false,
  isConfigPanelOpen: false,
  configPanelContext: null,
};

function hudReducer(state: HUDState, action: HUDAction): HUDState {
  switch (action.type) {
    case "OPEN_TAB": {
      const existing = state.tabs.findIndex((tab) => tab.sessionId === action.tab.sessionId);
      if (existing !== -1) {
        const nextTabs = state.tabs.map((tab, index) => {
          if (index !== existing) return tab;
          return {
            ...tab,
            ...action.tab,
            subTab: tab.subTab,
          };
        });
        return {
          ...state,
          tabs: nextTabs,
          activeTabId: action.tab.sessionId,
          isExpanded: true,
        };
      }

      const withoutDuplicateTask = state.tabs.filter((tab) => tab.taskId !== action.tab.taskId);
      const newTab: HUDTab = { ...action.tab, subTab: "logs" };
      return {
        ...state,
        tabs: [...withoutDuplicateTask, newTab],
        activeTabId: action.tab.sessionId,
        isExpanded: true,
      };
    }

    case "CLOSE_TAB": {
      const remaining = state.tabs.filter((tab) => tab.sessionId !== action.sessionId);
      let nextActiveId = state.activeTabId;
      if (state.activeTabId === action.sessionId) {
        nextActiveId = remaining.length > 0 ? remaining[remaining.length - 1].sessionId : null;
      }
      return {
        ...state,
        tabs: remaining,
        activeTabId: nextActiveId,
        isExpanded: remaining.length > 0 ? state.isExpanded : false,
      };
    }

    case "FOCUS_TAB": {
      return { ...state, activeTabId: action.sessionId, isExpanded: true };
    }

    case "SET_SUB_TAB": {
      if (!state.activeTabId) return state;
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.sessionId === state.activeTabId ? { ...tab, subTab: action.subTab } : tab,
        ),
      };
    }

    case "TOGGLE_EXPANDED": {
      return { ...state, isExpanded: !state.isExpanded };
    }

    case "SET_EXPANDED": {
      return { ...state, isExpanded: action.expanded };
    }

    case "OPEN_CONFIG": {
      return {
        ...state,
        isConfigPanelOpen: true,
        configPanelContext: action.context,
      };
    }

    case "CLOSE_CONFIG": {
      return { ...state, isConfigPanelOpen: false, configPanelContext: null };
    }

    default:
      return state;
  }
}

const HUDContext = createContext<HUDContextType | undefined>(undefined);

export function SandboxHUDProvider({
  children,
  localLaunchHandler,
}: {
  children: ReactNode;
  localLaunchHandler?: LocalLaunchHandler;
}) {
  const [state, dispatch] = useReducer(hudReducer, initialState);

  const openTab = useCallback((tab: Omit<HUDTab, "subTab">) => {
    dispatch({ type: "OPEN_TAB", tab });
  }, []);

  const closeTab = useCallback((sessionId: string) => {
    dispatch({ type: "CLOSE_TAB", sessionId });
  }, []);

  const focusTab = useCallback((sessionId: string) => {
    dispatch({ type: "FOCUS_TAB", sessionId });
  }, []);

  const setSubTab = useCallback((subTab: HUDTab["subTab"]) => {
    dispatch({ type: "SET_SUB_TAB", subTab });
  }, []);

  const toggleExpanded = useCallback(() => {
    dispatch({ type: "TOGGLE_EXPANDED" });
  }, []);

  const setExpanded = useCallback((expanded: boolean) => {
    dispatch({ type: "SET_EXPANDED", expanded });
  }, []);

  const openConfig = useCallback((context: HUDConfigContext) => {
    dispatch({ type: "OPEN_CONFIG", context });
  }, []);

  const closeConfig = useCallback(() => {
    dispatch({ type: "CLOSE_CONFIG" });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const platform = (navigator as any).userAgentData?.platform ?? navigator.platform ?? "";
      const isMac = /mac/i.test(platform);
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (modifier && event.key === "j") {
        event.preventDefault();
        if (state.tabs.length > 0) {
          dispatch({ type: "TOGGLE_EXPANDED" });
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state.tabs.length]);

  const value: HUDContextType = {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    isExpanded: state.isExpanded,
    isConfigPanelOpen: state.isConfigPanelOpen,
    configPanelContext: state.configPanelContext,
    localLaunchHandler,
    openTab,
    closeTab,
    focusTab,
    setSubTab,
    toggleExpanded,
    setExpanded,
    openConfig,
    closeConfig,
  };

  return <HUDContext.Provider value={value}>{children}</HUDContext.Provider>;
}

export function useSandboxHUD(): HUDContextType {
  const context = useContext(HUDContext);
  if (!context) {
    throw new Error("useSandboxHUD must be used within a SandboxHUDProvider");
  }
  return context;
}
