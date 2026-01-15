"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState, type ChangeEvent } from "react"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useDeployVersion, useDeploymentLogsQuery, useProjectVersionsQuery, useUploadVersion } from "@/queries/projects"

const statusVariant = (status?: string) =>
  status?.includes("failed") ? "destructive" : status === "deployed" ? "default" : "secondary"

const formatDate = (value?: string) => {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

const formatStatus = (status?: string) => (status ? status.replaceAll("_", " ") : "unknown")

const formatId = (value?: string) => (value ? value.slice(0, 8) : "—")

export default function DeploymentBoardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId") || ""
  const { data: logs = [], isLoading: isLogsLoading } = useDeploymentLogsQuery(projectId || undefined)
  const { data: versions = [], isLoading: isVersionsLoading } = useProjectVersionsQuery(projectId || undefined)
  const uploadVersion = useUploadVersion()
  const deployVersion = useDeployVersion()
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [workerContent, setWorkerContent] = useState("")
  const [selectedFileName, setSelectedFileName] = useState("")
  const hasProject = Boolean(projectId)
  const isUploading = uploadVersion.isPending
  const activeDeployVersionId = deployVersion.variables?.versionId
  const visibleLogs = [...logs]
    .sort((first, second) => {
      const firstTime = first.createdAt ? new Date(first.createdAt).getTime() : 0
      const secondTime = second.createdAt ? new Date(second.createdAt).getTime() : 0
      return secondTime - firstTime
    })
    .slice(0, 10)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedFileName(file.name)
    file.text().then((text) => setWorkerContent(text))
  }

  const handleUploadOpenChange = (open: boolean) => {
    setIsUploadOpen(open)
    if (open) return
    setWorkerContent("")
    setSelectedFileName("")
  }

  const handleUploadVersion = () => {
    if (!projectId) return
    const content = workerContent.trim()
    if (!content) return
    uploadVersion.mutate(
      { id: projectId, workerContent: content },
      {
        onSuccess: () => {
          setWorkerContent("")
          setSelectedFileName("")
          setIsUploadOpen(false)
        },
      },
    )
  }

  const handleDeployVersion = (versionId?: string) => {
    if (!projectId || !versionId) return
    deployVersion.mutate({ id: projectId, versionId })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-muted/30">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-medium">Deployment board</h1>
              <p className="text-xs text-muted-foreground">Track releases, versions, and rollback options.</p>
            </div>
          </div>
          {hasProject ? (
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
              Project {projectId.slice(0, 8)}
            </Badge>
          ) : null}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {!hasProject ? (
          <div className="rounded-3xl border border-dashed border-border/50 bg-muted/30 p-10 text-center space-y-4">
            <div className="text-lg font-medium">Select a project to view deployments</div>
            <p className="text-sm text-muted-foreground">Deploy a project to populate your deployment history board.</p>
            <Button onClick={() => router.push("/dashboard")} className="rounded-full">
              Back to dashboard
            </Button>
          </div>
        ) : null}

        {hasProject ? (
          <Tabs defaultValue="deployments" className="space-y-4">
            <TabsList>
              <TabsTrigger value="deployments">Deployments</TabsTrigger>
              <TabsTrigger value="versions">Versions</TabsTrigger>
            </TabsList>

            <TabsContent value="deployments">
              <div className="rounded-3xl border border-border/50 bg-muted/20 p-6 space-y-4">
                <div>
                  <h2 className="text-base font-medium">Recent deployments</h2>
                  <p className="text-xs text-muted-foreground">
                    Review deployment logs and track recent status updates.
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLogsLoading
                      ? [1, 2, 3].map((row) => (
                          <TableRow key={`deployment-log-skeleton-${row}`}>
                            <TableCell>
                              <Skeleton className="h-5 w-20 rounded-full" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-40" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                          </TableRow>
                        ))
                      : null}
                    {!isLogsLoading
                      ? visibleLogs.map((log) => (
                          <TableRow key={log.id || `${log.status}-${log.createdAt}`}>
                            <TableCell>
                              <Badge variant={statusVariant(log.status)} className="capitalize">
                                {formatStatus(log.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{log.message || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                          </TableRow>
                        ))
                      : null}
                    {!isLogsLoading && logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No deployment logs yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="versions">
              <div className="rounded-3xl border border-border/50 bg-muted/20 p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-medium">Version library</h2>
                    <p className="text-xs text-muted-foreground">Upload a build and deploy any saved version.</p>
                  </div>
                  <Dialog open={isUploadOpen} onOpenChange={handleUploadOpenChange}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="rounded-full">
                        Upload version
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload a worker version</DialogTitle>
                        <DialogDescription>
                          Paste the worker script or attach a file to create a new version.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="version-file">Worker file (optional)</Label>
                          <Input id="version-file" type="file" accept=".js,.mjs" onChange={handleFileChange} />
                          {selectedFileName ? (
                            <p className="text-xs text-muted-foreground">Loaded {selectedFileName}</p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="worker-content">Worker content</Label>
                          <Textarea
                            id="worker-content"
                            value={workerContent}
                            onChange={(event) => setWorkerContent(event.target.value)}
                            placeholder="export default { fetch() { return new Response('Hello'); } }"
                            className="min-h-[140px]"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsUploadOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleUploadVersion}
                          disabled={!workerContent.trim() || isUploading || !projectId}
                        >
                          {isUploading ? "Uploading..." : "Upload version"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version ID</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isVersionsLoading
                      ? [1, 2, 3].map((row) => (
                          <TableRow key={`version-skeleton-${row}`}>
                            <TableCell>
                              <Skeleton className="h-4 w-28" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Skeleton className="h-8 w-24 ml-auto" />
                            </TableCell>
                          </TableRow>
                        ))
                      : null}
                    {!isVersionsLoading
                      ? versions.map((version) => {
                          const isDeployingVersion = deployVersion.isPending && activeDeployVersionId === version.id
                          return (
                            <TableRow key={version.id || version.created_on || "version-row"}>
                              <TableCell className="font-medium">{formatId(version.id)}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(version.created_on)}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(version.modified_on)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeployVersion(version.id)}
                                  disabled={!version.id || deployVersion.isPending}
                                >
                                  {isDeployingVersion ? "Deploying..." : "Deploy"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      : null}
                    {!isVersionsLoading && versions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No versions uploaded yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </main>
    </div>
  )
}
