import React from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';
import './AppErrorBoundary.css';

/**
 * Prevent a client-side rendering exception from leaving users with
 * an unexplained blank screen. Keep full details in the developer console.
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state={error:null};
  }
  static getDerivedStateFromError(error) {
    return {error};
  }
  componentDidCatch(error,info) {
    console.error('IET Grid could not render the workspace:',error,info);
  }
  render() {
    if(!this.state.error)return this.props.children;
    return <main className="ig-app-error" role="alert">
      <section className="ig-app-error-card">
        <span className="ig-app-error-icon"><AlertTriangle size={24}/></span>
        <span className="ig-app-error-kicker">IET GRID · WORKSPACE ERROR</span>
        <h1>Something prevented the workspace from loading.</h1>
        <p>The application encountered an unexpected interface error. Your campus records
          have not been changed by this message. Reload the page to try again.</p>
        <button type="button" onClick={()=>window.location.reload()}>
          <RefreshCw size={17}/> Reload workspace
        </button>
        {import.meta.env.DEV&&<pre className="ig-app-error-detail">{String(this.state.error?.message||this.state.error)}</pre>}
        <small>If the error continues, open Developer Tools (F12) → Console and share the
          first red error message with the development team.</small>
      </section>
    </main>;
  }
}
