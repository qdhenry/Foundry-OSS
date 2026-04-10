import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SandboxTerminal } from "./SandboxTerminal";

// ---------------------------------------------------------------------------
// Note: SandboxTerminal instantiates xterm.js and opens a WebSocket to a
// live sandbox container. In Storybook we render the shell UI only — the
// terminal div is present but xterm will not mount (no DOM canvas in the
// test environment). The Connect / Disconnect button states are driven by
// the `disabled` prop and the component's internal connection state.
// ---------------------------------------------------------------------------

const meta: Meta<typeof SandboxTerminal> = {
  title: "Sandbox/SandboxTerminal",
  component: SandboxTerminal,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "xterm.js WebSocket terminal for live interaction with a sandbox container. " +
          "In Storybook the terminal canvas is rendered but will not connect to a live session. " +
          "Use the Connected / Disconnected stories to review the control UI states.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SandboxTerminal>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * Default disconnected state — shows the Connect button.
 * Clicking Connect would normally open a WebSocket; in Storybook it
 * triggers `getConnectionInfo` which is a no-op mock action.
 */
export const Disconnected: Story = {
  name: "Disconnected — shows Connect button",
  args: {
    sessionId: "sess-terminal-1",
    disabled: false,
  },
};

/**
 * Disabled state — sandbox is not yet ready so connecting is blocked.
 */
export const DisabledNotReady: Story = {
  name: "Disabled — session not ready",
  args: {
    sessionId: "sess-terminal-provisioning",
    disabled: true,
  },
};

/**
 * Simulate the visual appearance of a connected session by rendering the
 * component without the disabled flag. The connect button will be shown
 * until a real WebSocket is established, which requires a live sandbox.
 * This story documents the expected shell layout at the connected breakpoint.
 */
export const ConnectedLayout: Story = {
  name: "Connected layout (static)",
  args: {
    sessionId: "sess-terminal-active",
    disabled: false,
  },
  decorators: [
    (Story) => (
      <div style={{ height: "400px" }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Demonstrates the terminal in a tall container simulating the HUD expanded
 * at the default 400 px height.
 */
export const InHUDContainer: Story = {
  name: "Inside HUD container (400 px)",
  args: {
    sessionId: "sess-terminal-hud",
    disabled: false,
  },
  decorators: [
    (Story) => (
      <div
        style={{
          height: "400px",
          background: "#0a0e1a",
          padding: "8px",
          borderRadius: "8px",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export const Mobile: Story = {
  name: "Mobile viewport",
  args: {
    sessionId: "sess-terminal-mobile",
    disabled: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "Tablet viewport",
  args: {
    sessionId: "sess-terminal-tablet",
    disabled: false,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
