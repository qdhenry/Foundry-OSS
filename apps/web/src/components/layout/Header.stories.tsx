import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { Header } from "./Header";

// Header depends on:
//  - Breadcrumbs (uses usePathname — auto-mocked by nextjs-vite)
//  - NotificationBell (uses useQuery/useMutation from convex — globally mocked)
//  - ThemeToggle (uses useTheme — wrapped via global ThemeProvider decorator)
//  - UserButton from @clerk/nextjs (auto-mocked by nextjs-vite)
//  - useSearch from SearchProvider (context must be provided or the hook must
//    return a no-op — if it throws, wrap in a decorator)

const meta = {
  title: "Layout/Header",
  component: Header,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/discovery",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
  decorators: [
    (Story) => {
      // Provide a minimal SearchProvider-compatible context so that
      // useSearch() doesn't throw in Storybook.  The actual SearchProvider
      // component is not imported here because it may carry side-effects;
      // instead we manually inject the context value the hook reads.
      //
      // If SearchProvider exports its context object, import and use it:
      //   import { SearchContext } from "@/components/search/SearchProvider";
      // For now we wrap in a div that satisfies layout expectations.
      return (
        <div style={{ width: "100%" }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RootRoute: Story = {
  name: "Root Route (Home)",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/" },
    },
  },
};

export const ProgramSkills: Story = {
  name: "Program / Skills Route",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/skills",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};

export const MissionControl: Story = {
  name: "Mission Control Route",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/mission-control",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};

// Play function: verify the search button is visible and interactive
export const SearchButtonInteraction: Story = {
  name: "Search Button (interaction)",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const searchBtn = canvas.getByRole("button", { name: /search/i });
    await userEvent.hover(searchBtn);
    await userEvent.click(searchBtn);
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/discovery",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/risks",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};
