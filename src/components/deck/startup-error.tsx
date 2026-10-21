export function StartupError({ message }: { message: string }) {
  return (
    <div role="alert" className="fixed inset-0 z-30 grid place-items-center bg-background/90 p-6 text-center">
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-lg font-semibold">The visuals could not start</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          Afterimage needs a browser with WebGL2 and WebAssembly. It has only been tested in Chromium.
        </p>
      </div>
    </div>
  )
}
