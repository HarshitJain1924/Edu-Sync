const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-black/20 px-8 py-12 backdrop-blur-xl">
      <div className="mx-auto grid w-full max-w-7xl gap-8 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#67e8f9] to-[#0ea5e9] text-[10px] font-bold text-[#001019]">E</span>
            <span className="font-headline text-xl font-bold text-white">EduSync</span>
          </div>
          <p className="mt-3 max-w-sm text-sm tracking-wide text-on-surface-variant">A focused learning operating system for schools, bootcamps, and ambitious self-learners.</p>
          <p className="mt-4 font-label text-[10px] uppercase tracking-[0.16em] text-[#93c5fd]">© 2026 EduSync. All rights reserved.</p>
        </div>

        <div className="md:col-span-4">
          <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[#93c5fd]">Product</p>
          <div className="mt-3 grid gap-2">
            <a className="text-sm text-on-surface-variant transition-colors hover:text-white" href="#products">Platform</a>
            <a className="text-sm text-on-surface-variant transition-colors hover:text-white" href="#results">Outcomes</a>
            <a className="text-sm text-on-surface-variant transition-colors hover:text-white" href="#faq">FAQ</a>
            <a className="text-sm text-on-surface-variant transition-colors hover:text-white" href="#">Status</a>
          </div>
        </div>

        <div className="md:col-span-3">
          <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[#93c5fd]">Legal</p>
          <div className="mt-3 grid gap-2">
            <a className="text-sm text-on-surface-variant transition-colors hover:text-white" href="#">Privacy</a>
            <a className="text-sm text-on-surface-variant transition-colors hover:text-white" href="#">Terms</a>
            <a className="text-sm text-on-surface-variant transition-colors hover:text-white" href="#">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
