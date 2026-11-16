import { Transition } from '@headlessui/react';
import { Link } from '@inertiajs/react';
import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useId, useRef, useState } from 'react';

const DropDownContext = createContext();

const ITEMS = 'a[href], button:not([disabled])';

// Menu (ex.: o da conta). Teclado: Enter/Espaço ou seta para baixo abre e leva o foco ao 1.º item; setas mudam de
// item; Esc fecha e devolve o foco ao botão; Tab fecha. O botão diz se o menu está aberto (aria-expanded).
const Dropdown = ({ children }) => {
    const [open, setOpen] = useState(false);
    const trigger = useRef(null);
    const menu = useRef(null);
    const id = useId();

    const toggleOpen = () => {
        setOpen((previousState) => !previousState);
    };
    const close = (refocus = true) => {
        setOpen(false);
        if (refocus) trigger.current?.querySelector('button, a')?.focus();
    };

    return (
        <DropDownContext.Provider value={{ open, setOpen, toggleOpen, close, trigger, menu, id }}>
            <div className="relative">{children}</div>
        </DropDownContext.Provider>
    );
};

const Trigger = ({ children }) => {
    const { open, setOpen, toggleOpen, trigger, id } = useContext(DropDownContext);
    const child = Children.only(children);

    return (
        <>
            <div
                ref={trigger}
                onClick={toggleOpen}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); }
                }}
            >
                {isValidElement(child)
                    ? cloneElement(child, { 'aria-expanded': open, 'aria-haspopup': 'menu', 'aria-controls': open ? id : undefined })
                    : child}
            </div>

            {open && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOpen(false)}
                ></div>
            )}
        </>
    );
};

const Content = ({
    align = 'right',
    width = '48',
    contentClasses = 'py-1 bg-surface',
    children,
}) => {
    const { open, setOpen, close, menu, id } = useContext(DropDownContext);

    // Ao abrir, o foco vai para o primeiro item
    useEffect(() => {
        if (!open) return undefined;
        const tx = setTimeout(() => menu.current?.querySelector(ITEMS)?.focus(), 0);
        return () => clearTimeout(tx);
    }, [open, menu]);

    const onKeyDown = (e) => {
        const items = [...(menu.current?.querySelectorAll(ITEMS) ?? [])];
        const i = items.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'Tab') setOpen(false);
        else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
        else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
        else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    };

    let alignmentClasses = 'origin-top';

    if (align === 'left') {
        alignmentClasses = 'ltr:origin-top-left rtl:origin-top-right start-0';
    } else if (align === 'right') {
        alignmentClasses = 'ltr:origin-top-right rtl:origin-top-left end-0';
    }

    let widthClasses = '';

    if (width === '48') {
        widthClasses = 'w-48';
    }

    return (
        <>
            <Transition
                show={open}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
            >
                <div
                    ref={menu}
                    id={id}
                    role="menu"
                    onKeyDown={onKeyDown}
                    className={`absolute z-50 mt-2 shadow-lg ${alignmentClasses} ${widthClasses}`}
                    onClick={() => setOpen(false)}
                >
                    <div
                        className={
                            `border border-line ` +
                            contentClasses
                        }
                    >
                        {children}
                    </div>
                </div>
            </Transition>
        </>
    );
};

const DropdownLink = ({ className = '', children, ...props }) => {
    return (
        <Link
            role="menuitem"
            {...props}
            className={
                'block w-full px-4 py-2 text-start text-sm leading-5 text-ink transition duration-150 ease-in-out hover:bg-surface2 focus:bg-surface2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ' +
                className
            }
        >
            {children}
        </Link>
    );
};

Dropdown.Trigger = Trigger;
Dropdown.Content = Content;
Dropdown.Link = DropdownLink;

export default Dropdown;
