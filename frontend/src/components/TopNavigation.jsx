import React, {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import {Bell, ChevronDown, Layers3, LogOut, Menu, UserRound, X} from 'lucide-react';
import './TopNavigation.css';

const displayName = value => value === 'Explore rooms' ? 'Campus map' : value;
const initials = value => String(value || 'Guest').trim().charAt(0).toUpperCase();

/**
 * Adaptation of the supplied SlideTabs: a single measured cursor moves to
 * hovered/focused tabs and rests on the active destination. Buttons, rather
 * than clickable <li> elements, preserve native keyboard navigation.
 */
export function SlideTabs({items,active,onNavigate}) {
  const trackRef = useRef(null);
  const tabRefs = useRef(new Map());
  const [position,setPosition] = useState({left:0,width:0,opacity:0});
  const reduceMotion = useReducedMotion();
  const selectedRef = useRef(active);
  selectedRef.current = active;
  const itemKeys = items.map(([name])=>name).join('|');

  const measure = name => {
    const tab=tabRefs.current.get(name);
    const track=trackRef.current;
    if(!tab||!track)return;
    const rect=tab.getBoundingClientRect();
    const parent=track.getBoundingClientRect();
    const next={left:rect.left-parent.left,width:rect.width,opacity:1};
    setPosition(previous => (
      Math.abs(previous.left-next.left)<0.5 &&
      Math.abs(previous.width-next.width)<0.5 &&
      previous.opacity===1 ? previous : next
    ));
  };

  useEffect(()=>{
    measure(active);
    const observer=typeof ResizeObserver!=='undefined'
      ?new ResizeObserver(()=>measure(selectedRef.current)):null;
    if(observer){
      if(trackRef.current)observer.observe(trackRef.current);
      for(const item of tabRefs.current.values())observer.observe(item);
    }
    const onResize=()=>measure(selectedRef.current);
    window.addEventListener('resize',onResize);
    return()=>{
      observer?.disconnect();
      window.removeEventListener('resize',onResize);
    };
  },[active,itemKeys]);

  return <nav className="ig-primary-nav" aria-label="Primary navigation">
    <div ref={trackRef} className="ig-slide-track" onMouseLeave={()=>measure(active)}
      onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))measure(active)}}>
      <motion.span aria-hidden="true" className="ig-slide-cursor"
        initial={false} animate={position}
        transition={reduceMotion?{duration:0}:{type:'tween',duration:0.18,ease:[0.22,1,0.36,1]}}/>
      {items.map(([name,Icon,badge])=><button type="button" key={name}
        ref={element=>{if(element)tabRefs.current.set(name,element);else tabRefs.current.delete(name)}}
        className={'ig-slide-tab'+(active===name?' is-active':'')}
        aria-current={active===name?'page':undefined}
        onMouseEnter={()=>measure(name)}
        onFocus={()=>measure(name)}
        onClick={()=>onNavigate(name)}>
        <Icon size={16} aria-hidden="true"/>
        <span>{displayName(name)}</span>
        {name==='Announcements'&&badge>0&&<span className="ig-tab-count">{badge}</span>}
      </button>)}
    </div>
  </nav>;
}

export default function TopNavigation({
  items,active,onNavigate,demo=false,noticeCount=0,
  userName='Guest',userRole='student',avatarUrl='',onSignOut
}) {
  const [mobileOpen,setMobileOpen]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const profileRef=useRef(null);
  const menuRef=useRef(null);
  const triggerRef=useRef(null);
  const reducedMotion=useReducedMotion();
  const visibleItems=items.map(([name,Icon])=>[name,Icon,name==='Announcements'?noticeCount:0]);

  const navigate=name=>{
    onNavigate(name);
    setMobileOpen(false);
    setProfileOpen(false);
  };

  useEffect(()=>{
    if(!profileOpen)return;
    const onPointer=event=>{
      if(!profileRef.current?.contains(event.target))setProfileOpen(false);
    };
    const onEscape=event=>{
      if(event.key==='Escape')setProfileOpen(false);
    };
    document.addEventListener('pointerdown',onPointer);
    document.addEventListener('keydown',onEscape);
    return()=>{document.removeEventListener('pointerdown',onPointer);document.removeEventListener('keydown',onEscape)};
  },[profileOpen]);

  useEffect(()=>{
    if(!mobileOpen)return;
    const onEscape=event=>{
      if(event.key==='Escape'){
        setMobileOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown',onEscape);
    return()=>document.removeEventListener('keydown',onEscape);
  },[mobileOpen]);

  useEffect(()=>{
    if(!mobileOpen)return;
    const query=window.matchMedia('(min-width: 1051px)');
    const onChange=event=>{if(event.matches)setMobileOpen(false)};
    query.addEventListener?.('change',onChange);
    return()=>query.removeEventListener?.('change',onChange);
  },[mobileOpen]);

  const signOut=()=>{
    setMobileOpen(false);
    setProfileOpen(false);
    onSignOut();
  };

  return <header className="ig-topnav">
    <div className="ig-topnav-inner">
      <button type="button" className="ig-topnav-brand" onClick={()=>navigate('Explore rooms')}
        aria-label="IET Grid, go to Campus map">
        <span className="ig-topnav-logo"><Layers3 size={21}/></span>
        <span className="ig-topnav-brand-copy"><strong>IET Grid</strong><small>Campus operations</small></span>
      </button>

      <SlideTabs items={visibleItems} active={active} onNavigate={navigate}/>

      <div className="ig-topnav-actions">
        {demo&&<span className="ig-topnav-demo" title="This workspace contains demonstration data">DEMO</span>}
        <button type="button" className="ig-topnav-icon" aria-label={'Announcements'+(noticeCount?' ('+noticeCount+' notices)':'')}
          title="Announcements" onClick={()=>navigate('Announcements')}>
          <Bell size={18}/>
          {noticeCount>0&&<i className="ig-notification-dot" aria-hidden="true"/>}
        </button>
        <div className="ig-profile-wrap" ref={profileRef}>
          <button type="button" className="ig-profile-trigger" aria-haspopup="menu"
            aria-expanded={profileOpen} aria-controls="ig-profile-menu"
            onClick={()=>setProfileOpen(value=>!value)}>
            <span className="ig-profile-avatar" aria-hidden="true">
              {avatarUrl?<img src={avatarUrl} alt="" className="ig-nav-avatar-image"/>:initials(userName)}
            </span>
            <span className="ig-profile-name">{userName}</span>
            <ChevronDown size={15} aria-hidden="true"/>
          </button>
          {profileOpen&&<div className="ig-profile-dropdown" id="ig-profile-menu" role="menu">
            <div className="ig-profile-heading"><strong>{userName}</strong><small>{demo?'Demo workspace':userRole+' account'}</small></div>
            <button type="button" role="menuitem" onClick={()=>navigate('My profile')}>
              <UserRound size={16}/> My profile
            </button>
            <button type="button" role="menuitem" onClick={signOut}><LogOut size={16}/> Sign out</button>
          </div>}
        </div>
        <button ref={triggerRef} type="button" className="ig-mobile-menu-button"
          aria-label={mobileOpen?'Close navigation':'Open navigation'}
          aria-controls="ig-mobile-nav" aria-expanded={mobileOpen}
          onClick={()=>setMobileOpen(open=>!open)}>
          {mobileOpen?<X size={22}/>:<Menu size={22}/>}
        </button>
      </div>
    </div>

    <AnimatePresence initial={false}>
      {mobileOpen&&<motion.div id="ig-mobile-nav" className="ig-mobile-layer"
        initial={reducedMotion?false:{opacity:0,y:-8}}
        animate={{opacity:1,y:0}}
        exit={reducedMotion?{opacity:0}:{opacity:0,y:-8}}
        transition={{duration:reducedMotion?0:0.17,ease:'easeOut'}}>
        <nav ref={menuRef} className="ig-mobile-panel" aria-label="Mobile navigation">
          {visibleItems.map(([name,Icon,badge])=><button type="button" key={name}
            className={'ig-mobile-link'+(active===name?' is-active':'')}
            aria-current={active===name?'page':undefined} onClick={()=>navigate(name)}>
            <Icon size={19}/><span>{displayName(name)}</span>
            {name==='Announcements'&&badge>0&&<span className="ig-mobile-count">{badge}</span>}
          </button>)}
          <button type="button" className={'ig-mobile-link'+(active==='My profile'?' is-active':'')}
            onClick={()=>navigate('My profile')} aria-current={active==='My profile'?'page':undefined}>
            <UserRound size={19}/><span>My profile</span>
          </button>
          <div className="ig-mobile-profile">
            <span className="ig-profile-avatar">{avatarUrl?<img src={avatarUrl} alt="" className="ig-nav-avatar-image"/>:initials(userName)}</span>
            <span><strong>{userName}</strong><small>{demo?'Preview workspace':userRole+' account'}</small></span>
            <button type="button" aria-label="Sign out" onClick={signOut}><LogOut size={18}/></button>
          </div>
        </nav>
        <button type="button" className="ig-mobile-dismiss"
          aria-label="Close navigation menu" onClick={()=>{setMobileOpen(false);triggerRef.current?.focus()}}/>
      </motion.div>}
    </AnimatePresence>
  </header>;
}
