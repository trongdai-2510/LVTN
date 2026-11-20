'use client';

/**
 * Shared admin icon system.
 *
 * The public names stay compatible with the previous Lucide-style adapter so
 * feature code does not need to know which icon package renders the glyph.
 * Motion is reserved for actions and navigation; status and disclosure icons
 * remain still to keep dense admin screens calm.
 */

import type { ComponentPropsWithoutRef, ComponentType } from 'react';
import {
  AlignCenterIcon,
  AlignLeftIcon,
  ArrowDownIcon,
  ArrowDownLeftIcon,
  ArrowDownRightIcon,
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
  BellRingIcon,
  BookOpenIcon,
  BoxesIcon,
  ChartBarIcon,
  ChartGanttIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckBigIcon,
  ClipboardIcon,
  ClockIcon,
  CloudUploadIcon,
  CopyIcon,
  CornerDownRightIcon,
  DownloadIcon,
  EllipsisIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  FileArchiveIcon,
  FileCheckIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileXIcon,
  FilterIcon,
  GitBranchPlusIcon,
  GitCompareArrowsIcon,
  GlobeIcon,
  HistoryIcon,
  HouseIcon,
  ImageIcon as AnimatedImageIcon,
  InboxIcon,
  InfoIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  LinkIcon,
  ListChecksIcon,
  ListChevronsUpDownIcon,
  ListIcon,
  ListOrderedIcon,
  LoaderCircleIcon,
  LogOutIcon,
  MailIcon,
  MapPinIcon,
  MenuIcon,
  MessageSquareIcon,
  MessageCircleMoreIcon,
  MinusIcon,
  MoveDiagonal2Icon,
  NavigationIcon,
  PackageIcon,
  PackageSearchIcon,
  PencilIcon,
  PhoneIcon,
  PlugZapIcon,
  PlusIcon,
  QuoteIcon,
  RefreshCwIcon,
  RouteIcon,
  SaveIcon,
  SearchIcon,
  SendIcon,
  ServerIcon,
  SettingsIcon,
  ShareIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  SparklesIcon,
  StarIcon,
  StoreIcon,
  TagIcon,
  TagsIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadIcon,
  UserRoundIcon,
  UsersIcon,
  UsersRoundIcon,
  XIcon
} from '@animateicons/react/lucide';

type AnimateIconSource = typeof AlignCenterIcon;
type AnimateIconProps = ComponentPropsWithoutRef<AnimateIconSource>;

type AdminIconProps = AnimateIconProps & {
  /** Accepted for compatibility; AnimateIcons uses its own fixed line weight. */
  strokeWidth?: number;
  /** Accepted for compatibility with the former Phosphor adapter. */
  weight?: string;
};

export type LucideIcon = ComponentType<AdminIconProps>;

type MotionMode = 'hover' | 'static';

function createAdminIcon(
  Source: AnimateIconSource,
  motion: MotionMode = 'hover'
): LucideIcon {
  function AdminIcon({
    className,
    size,
    duration,
    isAnimated,
    strokeWidth: _strokeWidth,
    weight: _weight,
    style,
    ...rest
  }: AdminIconProps) {
    const iconSize = resolveIconSize(size, className);
    const usesCssAnimation = className?.includes('animate-') ?? false;
    const ariaHidden = rest['aria-hidden'] ?? (rest['aria-label'] ? undefined : true);

    return (
      <Source
        {...rest}
        aria-hidden={ariaHidden}
        className={['admin-icon', className].filter(Boolean).join(' ')}
        data-admin-icon="true"
        data-icon-motion={motion}
        duration={duration ?? 0.25}
        isAnimated={isAnimated ?? (motion === 'hover' && !usesCssAnimation)}
        size={iconSize}
        style={style}
      />
    );
  }

  AdminIcon.displayName = `AdminIcon(${Source.displayName ?? 'Icon'})`;
  return AdminIcon;
}

function createStaticIcon(Source: AnimateIconSource): LucideIcon {
  return createAdminIcon(Source, 'static');
}

function resolveIconSize(size: number | undefined, className: string | undefined): number {
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) return size;

  const arbitraryPixelSize = className?.match(/(?:^|\s)(?:size|h|w)-\[(\d+(?:\.\d+)?)px\]/);
  if (arbitraryPixelSize) return Number(arbitraryPixelSize[1]);

  const spacingSize = className?.match(/(?:^|\s)(?:size|h|w)-(\d+(?:\.\d+)?)(?:\s|$)/);
  if (spacingSize) return Number(spacingSize[1]) * 4;

  return 20;
}

// Status and validation feedback: visually stable on dense forms and tables.
export const AlertCircle = createStaticIcon(TriangleAlertIcon);
export const AlertTriangle = createStaticIcon(TriangleAlertIcon);
export const BadgeCheck = createStaticIcon(CircleCheckBigIcon);
export const Check = createStaticIcon(CheckIcon);
export const CheckCircle2 = createStaticIcon(CircleCheckBigIcon);
export const CheckSquare2 = createStaticIcon(ListChecksIcon);
export const Clock = createStaticIcon(ClockIcon);
export const Info = createStaticIcon(InfoIcon);
export const Loader2 = createStaticIcon(LoaderCircleIcon);
export const ShieldAlert = createStaticIcon(ShieldXIcon);
export const TriangleAlert = createStaticIcon(TriangleAlertIcon);

// Disclosure and editor alignment already have state-driven CSS transitions.
export const AlignCenter = createAdminIcon(AlignCenterIcon);
export const AlignLeft = createAdminIcon(AlignLeftIcon);
export const ChevronDown = createStaticIcon(ChevronDownIcon);
export const ChevronLeft = createStaticIcon(ChevronLeftIcon);
export const ChevronRight = createStaticIcon(ChevronRightIcon);
export const ChevronUp = createStaticIcon(ChevronUpIcon);
export const GripVertical = createStaticIcon(EllipsisVerticalIcon);
export const Search = createStaticIcon(SearchIcon);

// Actions and navigation: short hover motion provides direct feedback.
export const Archive = createAdminIcon(FileArchiveIcon);
export const ArchiveRestore = createAdminIcon(HistoryIcon);
export const ArrowDown = createAdminIcon(ArrowDownIcon);
export const ArrowDownLeft = createAdminIcon(ArrowDownLeftIcon);
export const ArrowDownRight = createAdminIcon(ArrowDownRightIcon);
export const ArrowLeft = createAdminIcon(ArrowLeftIcon);
export const ArrowRight = createAdminIcon(ArrowRightIcon);
export const ArrowRightLeft = createAdminIcon(ArrowLeftRightIcon);
export const ArrowUp = createAdminIcon(ArrowUpIcon);
export const ArrowUpLeft = createAdminIcon(ArrowUpLeftIcon);
export const ArrowUpRight = createAdminIcon(ArrowUpRightIcon);
export const BarChart3 = createAdminIcon(ChartBarIcon);
export const BellRing = createAdminIcon(BellRingIcon);
export const BookOpen = createAdminIcon(BookOpenIcon);
export const Boxes = createAdminIcon(BoxesIcon);
export const Briefcase = createAdminIcon(ChartGanttIcon);
export const Building2 = createAdminIcon(StoreIcon);
export const ClipboardList = createAdminIcon(ClipboardIcon);
export const Copy = createAdminIcon(CopyIcon);
export const CornerDownRight = createAdminIcon(CornerDownRightIcon);
export const Database = createAdminIcon(ServerIcon);
export const DatabaseZap = createAdminIcon(PlugZapIcon);
export const Download = createAdminIcon(DownloadIcon);
export const ExternalLink = createAdminIcon(ExternalLinkIcon);
export const Eye = createAdminIcon(EyeIcon);
export const EyeOff = createAdminIcon(EyeOffIcon);
export const FileArchive = createAdminIcon(FileArchiveIcon);
export const FileCheck2 = createStaticIcon(FileCheckIcon);
export const FileDown = createAdminIcon(DownloadIcon);
export const FileImage = createAdminIcon(FileImageIcon);
export const FileSpreadsheet = createAdminIcon(FileSpreadsheetIcon);
export const FileText = createAdminIcon(FileTextIcon);
export const FileUp = createAdminIcon(UploadIcon);
export const Filter = createAdminIcon(FilterIcon);
export const FolderKanban = createAdminIcon(ChartGanttIcon);
export const FolderTree = createAdminIcon(ListChevronsUpDownIcon);
export const GalleryHorizontal = createAdminIcon(AnimatedImageIcon);
export const GitBranchPlus = createAdminIcon(GitBranchPlusIcon);
export const GitPullRequest = createAdminIcon(GitCompareArrowsIcon);
export const Globe2 = createAdminIcon(GlobeIcon);
export const Grid3X3 = createAdminIcon(LayoutGridIcon);
export const Handshake = createAdminIcon(UsersRoundIcon);
export const History = createAdminIcon(HistoryIcon);
export const Home = createAdminIcon(HouseIcon);
export const Image = createAdminIcon(AnimatedImageIcon);
export const ImageOff = createAdminIcon(FileXIcon);
export const Table = createAdminIcon(LayoutGridIcon);
export const Inbox = createAdminIcon(InboxIcon);
export const Layers = createAdminIcon(LayersIcon);
export const LayoutGrid = createAdminIcon(LayoutGridIcon);
export const Link2 = createAdminIcon(LinkIcon);
export const List = createAdminIcon(ListIcon);
export const ListChecks = createAdminIcon(ListChecksIcon);
export const ListOrdered = createAdminIcon(ListOrderedIcon);
export const ListTree = createAdminIcon(ListChevronsUpDownIcon);
export const LogOut = createAdminIcon(LogOutIcon);
export const Mail = createAdminIcon(MailIcon);
export const MapPin = createAdminIcon(MapPinIcon);
export const Menu = createAdminIcon(MenuIcon);
export const MessageSquare = createAdminIcon(MessageSquareIcon);
export const MessagesSquare = createAdminIcon(MessageCircleMoreIcon);
export const Minus = createStaticIcon(MinusIcon);
export const MoreHorizontal = createAdminIcon(EllipsisIcon);
export const MoreVertical = createAdminIcon(EllipsisVerticalIcon);
export const Move = createAdminIcon(MoveDiagonal2Icon);
export const Navigation = createAdminIcon(NavigationIcon);
export const Newspaper = createAdminIcon(FileTextIcon);
export const Package = createAdminIcon(PackageIcon);
export const PackageSearch = createAdminIcon(PackageSearchIcon);
export const PanelsTopLeft = createAdminIcon(LayoutDashboardIcon);
export const Pencil = createAdminIcon(PencilIcon);
export const Phone = createAdminIcon(PhoneIcon);
export const Plus = createAdminIcon(PlusIcon);
export const Quote = createAdminIcon(QuoteIcon);
export const RefreshCcw = createAdminIcon(RefreshCwIcon);
export const RefreshCw = createAdminIcon(RefreshCwIcon);
export const RotateCcw = createAdminIcon(RefreshCwIcon);
export const Route = createAdminIcon(RouteIcon);
export const Save = createAdminIcon(SaveIcon);
export const Send = createAdminIcon(SendIcon);
export const Settings = createAdminIcon(SettingsIcon);
export const Share2 = createAdminIcon(ShareIcon);
export const Shield = createAdminIcon(ShieldCheckIcon);
export const ShieldCheck = createStaticIcon(ShieldCheckIcon);
export const Sparkles = createAdminIcon(SparklesIcon);
export const Star = createAdminIcon(StarIcon);
export const Tag = createAdminIcon(TagIcon);
export const Tags = createAdminIcon(TagsIcon);
export const Trash2 = createAdminIcon(Trash2Icon);
export const Upload = createAdminIcon(UploadIcon);
export const UploadCloud = createAdminIcon(CloudUploadIcon);
export const UserRound = createAdminIcon(UserRoundIcon);
export const Users = createAdminIcon(UsersIcon);
export const Wrench = createAdminIcon(SettingsIcon);
export const X = createAdminIcon(XIcon);
