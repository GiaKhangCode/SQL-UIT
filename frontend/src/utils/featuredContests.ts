import type { Contest } from "../data/models";

const featuredStatusOrder: Record<Extract<Contest["status"], "Live" | "Upcoming">, number> = {
  Live: 0,
  Upcoming: 1,
};

function contestTimestamp(contest: Contest) {
  const timestamp = new Date(contest.opensAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/** Live events first, followed by the nearest upcoming events. */
export function selectFeaturedContests(contests: Contest[]) {
  return contests
    .filter((contest): contest is Contest & { status: "Live" | "Upcoming" } =>
      contest.status === "Live" || contest.status === "Upcoming")
    .sort((left, right) => {
      const statusDifference = featuredStatusOrder[left.status] - featuredStatusOrder[right.status];
      if (statusDifference) return statusDifference;
      const timeDifference = contestTimestamp(left) - contestTimestamp(right);
      return timeDifference || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    })
    .slice(0, 6);
}
