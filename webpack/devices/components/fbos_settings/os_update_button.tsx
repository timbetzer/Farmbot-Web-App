import * as React from "react";
import { t } from "i18next";
import { JobProgress } from "farmbot/dist";
import { SemverResult, semverCompare } from "../../../util";
import { OsUpdateButtonProps } from "./interfaces";
import { checkControllerUpdates } from "../../actions";
import { isString } from "lodash";

/** FBOS update button states. */
enum UpdateButton { upToDate, needsUpdate, unknown, none }

/** FBOS update button state => props. */
const buttonProps = (status: UpdateButton): {
  color: "green" | "gray" | "yellow", text: string
} => {
  switch (status) {
    case UpdateButton.needsUpdate:
      return { color: "green", text: t("UPDATE") };
    case UpdateButton.upToDate:
      return { color: "gray", text: t("UP TO DATE") };
    case UpdateButton.unknown:
      return { color: "yellow", text: t("Can't connect to release server") };
    default:
      return { color: "yellow", text: t("Can't connect to bot") };
  }
};

/** FBOS update download in progress. */
const isWorking = (job: JobProgress | undefined) =>
  job && (job.status == "working");

/** FBOS update download progress. */
function downloadProgress(job: JobProgress | undefined) {
  if (job && isWorking(job)) {
    switch (job.unit) {
      case "bytes":
        const kiloBytes = Math.round(job.bytes / 1024);
        const megaBytes = Math.round(job.bytes / 1048576);
        if (kiloBytes < 1) {
          return job.bytes + "B";
        } else if (megaBytes < 1) {
          return kiloBytes + "kB";
        } else {
          return megaBytes + "MB";
        }
      case "percent":
        return job.percent + "%";
    }
  }
}

/** Determine the latest available version. */
const getLatestVersion = (
  currentOSVersion: string | undefined,
  currentBetaOSVersion: string | undefined,
  betaOptIn: boolean
): string | undefined => {
  if (!betaOptIn) { return currentOSVersion; }
  switch (semverCompare(currentOSVersion || "", currentBetaOSVersion || "")) {
    case SemverResult.RIGHT_IS_GREATER: return currentBetaOSVersion;
    default: return currentOSVersion;
  }
};

/** Unequal beta commits => needs update. */
const betaCommitsAreEqual = (
  fbosCommit: string | undefined,
  currentBetaOSCommit: string | undefined): boolean =>
  !(isString(fbosCommit) && isString(currentBetaOSCommit)
    && fbosCommit !== currentBetaOSCommit);

/** Determine the FBOS update button state. */
const compareWithBotVersion = (
  candidate: string | undefined,
  controller_version: string | undefined
): UpdateButton => {
  if (!isString(controller_version)) { return UpdateButton.none; }
  if (!isString(candidate)) { return UpdateButton.unknown; }

  switch (semverCompare(candidate, controller_version)) {
    case SemverResult.RIGHT_IS_GREATER:
    case SemverResult.EQUAL:
      return UpdateButton.upToDate;
    default:
      return UpdateButton.needsUpdate;
  }
};

export const OsUpdateButton = (props: OsUpdateButtonProps) => {
  const { bot, sourceFbosConfig, botOnline } = props;
  let buttonStatus = UpdateButton.none;

  /** FBOS beta release opt-in setting. */
  const betaOptIn = sourceFbosConfig("beta_opt_in").value;
  // Information about available releases.
  const { currentOSVersion, currentBetaOSVersion, currentBetaOSCommit } = bot;
  // Currently installed FBOS version data.
  const { controller_version, commit } = bot.hardware.informational_settings;

  /** Newest release version, given settings and data available. */
  const latestReleaseV =
    getLatestVersion(currentOSVersion, currentBetaOSVersion, !!betaOptIn);
  // Set FBOS update button status.
  buttonStatus = compareWithBotVersion(latestReleaseV, controller_version);

  /** `1.0.0-beta vs 1.0.0` could be disguised as `1.0.0 vs 1.0.0`
   *  since `controller_version` is truncated.
   */
  const uncertainty = (buttonStatus === UpdateButton.upToDate) && betaOptIn;
  /** It's actually `1.0.0-beta vs 1.0.0-beta`, but installed beta is old. */
  const oldBetaCommit = latestReleaseV === currentBetaOSVersion &&
    !betaCommitsAreEqual(commit, currentBetaOSCommit);
  /** It's actually `1.0.0-beta vs 1.0.0` therefore needs update to `1.0.0`. */
  // tslint:disable-next-line:no-any
  const oldBeta = (bot.hardware.informational_settings as any).currently_on_beta;
  // Button status modification for beta release edge cases.
  if (uncertainty && (oldBetaCommit || oldBeta)) {
    buttonStatus = UpdateButton.needsUpdate;
  }

  /** FBOS update download progress data. */
  const osUpdateJob = (bot.hardware.jobs || {})["FBOS_OTA"];

  return <button
    className={"fb-button " + buttonProps(buttonStatus).color}
    title={latestReleaseV}
    disabled={isWorking(osUpdateJob) || !botOnline}
    onClick={checkControllerUpdates}>
    {downloadProgress(osUpdateJob) || buttonProps(buttonStatus).text}
  </button>;
};
