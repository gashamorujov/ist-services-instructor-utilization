import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-100 p-6">
          <div className="max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Xəta baş verdi</h2>
            <p className="mt-2 text-sm text-slate-500">
              Tətbiqdə gözlənilməz xəta baş verdi. Səhifəni yenidən yükləməyi sınayın.
            </p>
            {this.state.error && (
              <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-red-50 p-3 text-left text-xs text-red-600">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Yenidən yüklə
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
