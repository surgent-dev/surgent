"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Github, ExternalLink, Loader2, Check, Unplug, Clock, GitBranch, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useGitHubStatus,
  useGitHubInstallUrl,
  useGitHubDisconnect,
  useGitHubPush,
  useGitHubCreateRepo,
} from "@/queries/github";
import { cn } from "@/lib/utils";

interface GitHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}

export default function GitHubDialog({ open, onOpenChange, projectId }: GitHubDialogProps) {
  const [repoName, setRepoName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(null);

  const { data: status, isLoading: statusLoading } = useGitHubStatus(projectId, { enabled: open });
  const {
    data: installUrlData,
    refetch: refetchInstallUrl,
    isFetching: isFetchingInstallUrl,
  } = useGitHubInstallUrl(projectId, { enabled: false });

  const createRepoMutation = useGitHubCreateRepo();
  const disconnectMutation = useGitHubDisconnect();
  const pushMutation = useGitHubPush();

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setRepoName("");
      setDescription("");
      setIsPrivate(false);
      setSelectedInstallationId(null);
    }
  }, [open]);

  const handleInstall = async () => {
    if (!projectId) return;
    if (installUrlData?.url) {
      window.location.href = installUrlData.url;
      return;
    }
    const result = await refetchInstallUrl();
    if (result.data?.url) {
      window.location.href = result.data.url;
    }
  };

  const handleCreate = async () => {
    if (!projectId || !repoName.trim() || !status?.oauthLinked) return;
    const installationId = Number(selectedInstallationId ?? status?.installation?.id ?? installations[0]?.id);

    try {
      const result = await createRepoMutation.mutateAsync({
        projectId,
        name: repoName,
        description,
        private: isPrivate,
        installationId,
      });

      if (result.success) {
        toast.success("Repository created and connected!");
      } else {
        toast.error(result.error || "Failed to create repository");
      }
    } catch (error: unknown) {
      const err = error as { response?: Response };
      const body = await err.response?.json().catch(() => null);
      const message = body?.error?.message || body?.error || "Failed to create repository";
      toast.error(message);
    }
  };

  const handleDisconnect = async () => {
    if (!projectId) return;

    try {
      await disconnectMutation.mutateAsync(projectId);
      toast.success("Repository disconnected");
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  const handlePush = async () => {
    if (!projectId) return;

    try {
      const result = await pushMutation.mutateAsync(projectId);
      if (result.success) {
        const shortSha = result.sha?.slice(0, 7);
        toast.success(shortSha ? `Pushed successfully! SHA: ${shortSha}` : "Pushed successfully!");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Push failed");
      }
    } catch {
      toast.error("Failed to push to GitHub");
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString();
  };

  const installations =
    status?.installations && status.installations.length > 0
      ? status.installations
      : status?.installation
        ? [status.installation]
        : [];
  const userAccount = installations.find((item) => item.accountType.toLowerCase() === "user");
  const accountTypeLabel = (type: string) => (type.toLowerCase() === "user" ? "Personal" : "Org");
  const defaultInstallationId = status?.installation?.id ?? installations[0]?.id ?? null;

  useEffect(() => {
    if (!open || !defaultInstallationId || selectedInstallationId) return;
    setSelectedInstallationId(defaultInstallationId);
  }, [defaultInstallationId, open, selectedInstallationId]);

  const isConnected = status?.connected;
  const isInstalled = status?.installed;
  const isOauthLinked = status?.oauthLinked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl border shadow-lg bg-background"
      >
        {/* Header Row */}
        <div className="flex h-10 items-center justify-between px-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Github className="size-4" />
            <DialogTitle className="text-sm font-medium">GitHub</DialogTitle>
            {statusLoading ? (
              <Loader2 className="size-2.5 animate-spin text-muted-foreground" />
            ) : (
              <div
                className={cn("size-2 rounded-full", isOauthLinked ? "bg-success" : "bg-muted-foreground/30")}
                title={isOauthLinked ? "Authorized" : "Not authorized"}
              />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-full hover:bg-muted/50"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-3.5 text-muted-foreground" />
          </Button>
        </div>

        {statusLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !isInstalled ? (
          // Not installed state
          <div className="flex flex-col items-center justify-center py-8 px-6 space-y-4">
            <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center">
              <Github className="size-6 text-foreground" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-medium">Connect GitHub</h3>
              <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
                Install the Surgent GitHub App to create repositories and push your code.
              </p>
            </div>
            <Button onClick={handleInstall} size="sm" className="px-6 text-sm" disabled={isFetchingInstallUrl}>
              Install GitHub App
              <ExternalLink className="size-3 ml-2 opacity-50" />
            </Button>
          </div>
        ) : !isConnected ? (
          // Installed but not connected (Create Repo)
          <div className="flex flex-col">
            {/* Stats Bar */}
            <div className="h-8 flex items-center px-4 gap-2 text-xs border-b bg-muted/10">
              <span className="text-muted-foreground">Connected as</span>
              <span className="font-medium text-foreground">{userAccount ? userAccount.account : "User"}</span>

              {installations.length > 1 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{installations.length} accounts</span>
                </>
              )}

              <div className="flex-1" />

              <button
                onClick={handleInstall}
                disabled={isFetchingInstallUrl}
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="size-3" />
                Add account
              </button>
            </div>

            {/* Create Form */}
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                {installations.length > 1 ? (
                  <div className="space-y-2">
                    <Label htmlFor="github-account" className="text-xs font-medium text-muted-foreground ml-1">
                      Target account
                    </Label>
                    <Select
                      value={selectedInstallationId ? String(selectedInstallationId) : ""}
                      onValueChange={(value) => setSelectedInstallationId(Number(value))}
                    >
                      <SelectTrigger
                        id="github-account"
                        className="h-9 rounded-lg bg-muted/30 border-transparent focus:border-input focus:bg-background transition-all"
                      >
                        <SelectValue placeholder="Choose account" />
                      </SelectTrigger>
                      <SelectContent>
                        {installations.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.account} · {accountTypeLabel(item.accountType)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="repo-name" className="text-xs font-medium text-muted-foreground ml-1">
                    Repository Name
                  </Label>
                  <Input
                    id="repo-name"
                    placeholder="e.g. my-awesome-project"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    className="h-9 rounded-lg bg-muted/30 border-transparent focus:border-input focus:bg-background transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repo-desc" className="text-xs font-medium text-muted-foreground ml-1">
                    Description <span className="opacity-50 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="repo-desc"
                    placeholder="Brief description of your project"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-9 rounded-lg bg-muted/30 border-transparent focus:border-input focus:bg-background transition-all"
                  />
                </div>

                <div className="flex items-center justify-between py-1 px-1">
                  <div className="space-y-0.5">
                    <Label htmlFor="private-mode" className="text-sm font-medium">
                      Private Repository
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Only you can see this repository</p>
                  </div>
                  <Switch id="private-mode" checked={isPrivate} onCheckedChange={setIsPrivate} className="scale-90" />
                </div>
              </div>

              <Button
                onClick={handleCreate}
                disabled={!repoName.trim() || createRepoMutation.isPending || !isOauthLinked}
                className="w-full font-medium"
              >
                {createRepoMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Github className="size-4 mr-2" />
                )}
                {createRepoMutation.isPending ? "Creating..." : "Create & Connect"}
              </Button>

              {!isOauthLinked && (
                <div className="text-center">
                  <p className="text-xs text-warning mb-2">Authorization required</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleInstall}
                    className="text-xs"
                    disabled={isFetchingInstallUrl}
                  >
                    Authorize GitHub
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Connected State
          <div className="flex flex-col">
            {/* Repo Info Bar */}
            <div className="h-8 flex items-center px-4 gap-2 text-xs border-b bg-muted/10">
              <a
                href={`https://github.com/${status.repo?.fullName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline flex items-center gap-1.5 truncate"
              >
                {status.repo?.fullName}
                <ExternalLink className="size-2.5 text-muted-foreground" />
              </a>

              <span className="text-muted-foreground">·</span>

              <div className="flex items-center gap-1 text-muted-foreground">
                <GitBranch className="size-3" />
                <span>main</span>
              </div>

              {status.repo?.lastPushedSha && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <div className="flex items-center gap-1 text-muted-foreground truncate">
                    <Clock className="size-3" />
                    <span>{formatDate(status.repo.lastPushAt)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4 flex flex-col items-center justify-center text-center space-y-2">
                <div className="size-10 rounded-full bg-background border shadow-sm flex items-center justify-center mb-1">
                  <Github className="size-5" />
                </div>
                <h4 className="text-sm font-medium">Ready to push</h4>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  Sync your latest changes to the remote repository.
                </p>
              </div>

              <Button onClick={handlePush} disabled={pushMutation.isPending} className="w-full font-medium shadow-sm">
                {pushMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Github className="size-4 mr-2" />
                )}
                {pushMutation.isPending ? "Pushing..." : "Push to GitHub"}
              </Button>

              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  <Unplug className="size-3 mr-1.5" />
                  Disconnect repository
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
