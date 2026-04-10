import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { CommitsSection } from "./CommitsSection";

const NOW = Date.now();
const mins = (n: number) => NOW - n * 60_000;
const hours = (n: number) => NOW - n * 3_600_000;
const days = (n: number) => NOW - n * 86_400_000;

const MOCK_COMMITS = [
  {
    sha: "a1b2c3d4e5f6789012345678901234567890abcd",
    message:
      "feat(checkout): add stock validation before cart processing\n\nPreviously we would allow checkout to proceed even when items were out of stock.\nThis change adds an explicit validation step that checks available inventory\nbefore progressing through the checkout flow.\n\nCloses #112",
    authorLogin: "alice-dev",
    authorName: "Alice Chen",
    timestamp: mins(45),
    url: "https://github.com/acme-corp/sf-b2b/commit/a1b2c3d",
    filesChanged: 4,
    additions: 87,
    deletions: 12,
  },
  {
    sha: "b2c3d4e5f6789012345678901234567890abcde",
    message: "refactor(cart): extract CartOptions interface to shared types",
    authorLogin: "alice-dev",
    authorName: "Alice Chen",
    timestamp: hours(2),
    url: "https://github.com/acme-corp/sf-b2b/commit/b2c3d4e",
    filesChanged: 2,
    additions: 28,
    deletions: 5,
  },
  {
    sha: "c3d4e5f6789012345678901234567890abcdef0",
    message: "test(checkout): add coverage for skipValidation option",
    authorLogin: "alice-dev",
    authorName: "Alice Chen",
    timestamp: hours(3),
    url: "https://github.com/acme-corp/sf-b2b/commit/c3d4e5f",
    filesChanged: 1,
    additions: 32,
    deletions: 0,
  },
  {
    sha: "d4e5f6789012345678901234567890abcdef01",
    message: "chore: remove deprecated OldCheckout module",
    authorLogin: "bob-reviewer",
    authorName: "Bob Martinez",
    timestamp: days(1),
    url: "https://github.com/acme-corp/sf-b2b/commit/d4e5f67",
    filesChanged: 1,
    additions: 0,
    deletions: 156,
  },
  {
    sha: "e5f6789012345678901234567890abcdef0123",
    message: "fix(cart): correct rename CartController from legacy name",
    authorLogin: "bob-reviewer",
    authorName: "Bob Martinez",
    timestamp: days(2),
    url: "https://github.com/acme-corp/sf-b2b/commit/e5f6789",
    filesChanged: 1,
    additions: 5,
    deletions: 5,
  },
];

const SINGLE_COMMIT = [
  {
    sha: "f6789012345678901234567890abcdef012345",
    message: "feat: initial implementation of B2B checkout flow",
    authorLogin: "carol-eng",
    authorName: "Carol Singh",
    timestamp: mins(15),
    url: "https://github.com/acme-corp/sf-b2b/commit/f678901",
    filesChanged: 12,
    additions: 340,
    deletions: 0,
  },
];

const NO_URL_COMMITS = MOCK_COMMITS.map(({ url: _url, ...c }) => c);

const meta: Meta<typeof CommitsSection> = {
  title: "SourceControl/CommitsSection",
  component: CommitsSection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof CommitsSection>;

export const Default: Story = {
  args: {
    commits: MOCK_COMMITS,
  },
};

export const ExpandCommitBody: Story = {
  args: {
    commits: MOCK_COMMITS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Expand the first commit's body by clicking "more"
    const moreButtons = canvas.getAllByRole("button", { name: /more/i });
    if (moreButtons.length > 0) {
      await userEvent.click(moreButtons[0]);
    }
  },
};

export const SingleCommit: Story = {
  args: {
    commits: SINGLE_COMMIT,
  },
};

export const EmptyState: Story = {
  args: {
    commits: [],
  },
};

export const NoUrls: Story = {
  name: "Commits Without GitHub Links",
  args: {
    commits: NO_URL_COMMITS as any,
  },
};

export const CollapsedSection: Story = {
  args: {
    commits: MOCK_COMMITS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("button", { name: /commits/i });
    await userEvent.click(header);
  },
};

export const Mobile: Story = {
  args: {
    commits: MOCK_COMMITS,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    commits: MOCK_COMMITS,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
