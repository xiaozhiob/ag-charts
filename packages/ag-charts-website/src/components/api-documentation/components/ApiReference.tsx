import Code from '@ag-website-shared/components/code/Code';
import { Icon } from '@ag-website-shared/components/icon/Icon';
import styles from '@ag-website-shared/components/reference-documentation/ApiReference.module.scss';
import { navigate, scrollIntoViewById, useLocation } from '@ag-website-shared/utils/navigation';
import type {
    ApiReferenceNode,
    ApiReferenceType,
    MemberNode,
    TypeAliasNode,
} from '@generate-code-reference-plugin/doc-interfaces/types';
import { fetchInterfacesReference } from '@utils/client/fetchInterfacesReference';
import { useToggle } from '@utils/hooks/useToggle';
import { urlWithBaseUrl } from '@utils/urlWithBaseUrl';
import classnames from 'classnames';
import type { AllHTMLAttributes, CSSProperties } from 'react';
import { createContext, useContext, useEffect } from 'react';
import Markdown from 'react-markdown';
import { QueryClient, QueryClientProvider, useQuery } from 'react-query';
import remarkBreaks from 'remark-breaks';

import type { SpecialTypesMap } from '../apiReferenceHelpers';
import {
    cleanupName,
    formatTypeToCode,
    getMemberType,
    isInterfaceHidden,
    normalizeType,
    processMembers,
} from '../apiReferenceHelpers';
import { SelectionContext } from './OptionsNavigation';
import { type CollapsibleType, PropertyTitle, PropertyType } from './Properties';

export const ApiReferenceContext = createContext<ApiReferenceType | undefined>(undefined);
export const ApiReferenceConfigContext = createContext<ApiReferenceConfig>({});

// NOTE: Not on the layout level, as that is generated at build time, and queryClient needs to be
// loaded on the client side
const queryClient = new QueryClient();

const queryOptions = {
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
};

export interface ApiReferenceConfig {
    prioritise?: string[];
    include?: string[];
    exclude?: string[];
    hideHeader?: boolean;
    hideRequired?: boolean;
    specialTypes?: SpecialTypesMap;
    keepExpanded?: string[];
}

interface ApiReferenceOptions {
    id: string;
    anchorId?: string;
    className?: string;
    isInline?: boolean;
}

interface ApiReferenceRowOptions {
    member: MemberNode;
    anchorId: string;
    prefixPath?: string[];
    isExpanded?: boolean;
    nestedPath?: string;
    typeArguments?: string[];
    genericsMap?: Record<string, string>;
    onDetailsToggle?: () => void;
}

export function ApiReferenceWithContext({
    prioritise,
    include,
    exclude,
    hideHeader,
    hideRequired,
    ...props
}: ApiReferenceOptions & ApiReferenceConfig) {
    return (
        <QueryClientProvider client={queryClient}>
            <ApiReferenceConfigContext.Provider value={{ prioritise, include, exclude, hideHeader, hideRequired }}>
                <ApiReferenceWithReferenceContext {...props} />
            </ApiReferenceConfigContext.Provider>
        </QueryClientProvider>
    );
}

export function ApiReferenceWithReferenceContext(props: ApiReferenceOptions & ApiReferenceConfig) {
    const { data: reference } = useQuery(['resolved-interfaces'], fetchInterfacesReference, queryOptions);
    return (
        <ApiReferenceContext.Provider value={reference}>
            <ApiReference {...props} />
        </ApiReferenceContext.Provider>
    );
}

export function ChildPropertiesButton({
    name,
    isExpanded,
    onClick,
}: {
    name: string;
    isExpanded?: boolean;
    onClick?: () => void;
    collapsibleType?: CollapsibleType;
}) {
    return (
        <button
            className={classnames(styles.childButton, 'button-as-link', {
                [styles.isExpanded]: isExpanded,
            })}
            onClick={onClick}
            aria-label={`See child properties of ${name}`}
        >
            <Icon svgClasses={styles.childChevron} name="chevronRight" />
            <span>See child properties</span>
        </button>
    );
}

export function ApiReference({
    id,
    anchorId,
    className,
    isInline,
    ...props
}: ApiReferenceOptions & AllHTMLAttributes<Element>) {
    const reference = useContext(ApiReferenceContext);
    const config = useContext(ApiReferenceConfigContext);
    const interfaceRef = reference?.get(id);
    const location = useLocation();

    useEffect(() => {
        const hash = location?.hash.substring(1);
        if (typeof anchorId === 'string' && hash === anchorId) {
            scrollIntoViewById(anchorId);
        }
    }, [location?.hash]);

    if (interfaceRef?.kind !== 'interface') {
        return null;
    }

    return (
        <div
            {...props}
            className={classnames(styles.apiReferenceOuter, className, {
                [styles.isInline]: isInline,
            })}
        >
            {anchorId && <a id={anchorId} />}
            {!config.hideHeader &&
                (interfaceRef.docs?.join('\n') ?? (
                    <p className={styles.propertyDescription}>
                        Properties available on the <code>{id}</code> interface.
                    </p>
                ))}

            <div className={classnames(styles.reference, styles.apiReference, 'no-zebra')}>
                <div>
                    {processMembers(interfaceRef, config).map((member) => (
                        <NodeFactory
                            key={member.name}
                            member={member}
                            anchorId={`reference-${id}-${member.name}`}
                            genericsMap={interfaceRef.genericsMap}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function NodeFactory({ member, anchorId, genericsMap, prefixPath = [], ...props }: ApiReferenceRowOptions) {
    const [isExpanded, toggleExpanded, setExpanded] = useToggle();
    const interfaceRef = useMemberAdditionalDetails(member);
    const config = useContext(ApiReferenceConfigContext);
    const reference = useContext(ApiReferenceContext);
    const location = useLocation();

    const hasMembers = interfaceRef && 'members' in interfaceRef;
    const hasNestedPages = config.specialTypes?.[getMemberType(member)] === 'NestedPage';

    let skip: string[] | undefined;
    if (member.omit && reference?.has(member.omit)) {
        const omitType = reference.get(member.omit)!;
        if (omitType.kind === 'typeAlias' && typeof omitType.type === 'object' && omitType.type.kind === 'union') {
            skip = omitType.type.type.map((type) => normalizeType(type).replace(/^'(.*)'$/, '$1'));
        }
    }

    let typeArguments: string[] | undefined;
    if (hasMembers && typeof member.type === 'object' && member.type.kind === 'typeRef') {
        typeArguments = member.type.typeArguments?.map((genericType) =>
            normalizeType(genericsMap?.[genericType as any] ?? genericType)
        );
    }

    useEffect(() => {
        const hash = location?.hash.substring(1);
        if (hash === anchorId) {
            scrollToAndHighlightById(anchorId);
        } else if (hasMembers && hash?.startsWith(`${anchorId}-`)) {
            setExpanded(true);
        }
    }, [location?.hash]);

    return (
        <>
            <ApiReferenceRow
                {...props}
                member={member}
                anchorId={anchorId}
                prefixPath={prefixPath}
                isExpanded={isExpanded}
                onDetailsToggle={toggleExpanded}
            />
            {hasMembers && isExpanded && (
                <div className={styles.childPropsList}>
                    {processMembers(interfaceRef, config, typeArguments)
                        .filter((childMember) => !skip?.includes(childMember.name))
                        .map((childMember) => (
                            <NodeFactory
                                key={childMember.name}
                                member={childMember}
                                anchorId={`${anchorId}-${cleanupName(childMember.name)}`}
                                prefixPath={prefixPath.concat(member.name)}
                                genericsMap={(interfaceRef as any).genericsMap}
                                nestedPath={
                                    hasNestedPages
                                        ? `${location?.pathname}/${member.name}/${cleanupName(childMember.name)}`
                                        : undefined
                                }
                            />
                        ))}
                </div>
            )}
        </>
    );
}

function ApiReferenceRow({
    member,
    anchorId,
    prefixPath,
    isExpanded,
    nestedPath,
    onDetailsToggle,
}: ApiReferenceRowOptions) {
    const config = useContext(ApiReferenceConfigContext);
    const selection = useContext(SelectionContext);
    const memberName = cleanupName(member.name);
    const memberType = normalizeType(member.type);
    const additionalDetails = useMemberAdditionalDetails(member);
    const collapsibleType = getCollapsibleType({ additionalDetails, nestedPath });
    const hasChildProps = collapsibleType === 'childrenProperties';

    return (
        <div
            id={anchorId}
            className={classnames(
                'property-row',
                styles.propertyRow,
                prefixPath && prefixPath.length > 0 && styles.isChildProp,
                isExpanded && hasChildProps && styles.expandedChildProps
            )}
            style={{ '--nested-path-depth': prefixPath?.length ?? 0 } as CSSProperties}
        >
            <div className={styles.leftColumn}>
                <PropertyTitle
                    name={memberName}
                    anchorId={anchorId}
                    prefixPath={prefixPath}
                    required={!config.hideRequired && !member.optional}
                    hasChildProps={hasChildProps}
                    childPropsOnClick={onDetailsToggle}
                />
                <PropertyType
                    name={memberName}
                    type={memberType}
                    defaultValue={member.defaultValue}
                    collapsibleType={collapsibleType}
                    isExpanded={isExpanded}
                    onCollapseClick={onDetailsToggle}
                />
            </div>
            <div className={styles.rightColumn}>
                <div role="presentation" className={styles.description}>
                    <Markdown remarkPlugins={[remarkBreaks]} urlTransform={(url: string) => urlWithBaseUrl(url)}>
                        {member.docs?.join('\n')}
                    </Markdown>
                    {hasChildProps && (
                        <ChildPropertiesButton name={memberName} isExpanded={isExpanded} onClick={onDetailsToggle} />
                    )}
                </div>
                {nestedPath && (
                    <div className={styles.actions}>
                        <a
                            href={nestedPath}
                            onClick={(event) => {
                                event.preventDefault();
                                const selectionState = {
                                    pathname: nestedPath,
                                    hash: `reference-${memberType}`,
                                    pageInterface: memberType,
                                    pageTitle: { name: memberName },
                                };
                                selection?.setSelection(selectionState);
                                navigate(selectionState, { state: selectionState });
                            }}
                        >
                            See property details <Icon name="arrowRight" />
                        </a>
                    </div>
                )}
            </div>

            {collapsibleType === 'code' && isExpanded && (
                <div id={getDetailsId(anchorId)} className={classnames(styles.expandedContent)}>
                    <TypeCodeBlock apiNode={additionalDetails!} member={member} />
                </div>
            )}
        </div>
    );
}

type ApiNode = ApiReferenceNode | MemberNode;

export function TypeCodeBlock({ apiNode, member }: { apiNode: ApiNode | ApiNode[]; member: MemberNode }) {
    const reference = useContext(ApiReferenceContext);

    if (!reference) {
        return null;
    }

    const codeSample = Array.isArray(apiNode)
        ? apiNode.map((apiNode) => formatTypeToCode(apiNode, member, reference))
        : formatTypeToCode(apiNode, member, reference);

    if (!codeSample?.length) {
        // eslint-disable-next-line no-console
        console.warn('Unknown API node', apiNode);
        return null;
    }

    return <Code code={codeSample} />;
}

function getCollapsibleType({ additionalDetails, nestedPath }): CollapsibleType {
    const hasMembers = additionalDetails && 'members' in additionalDetails;
    let collapsibleType: CollapsibleType = 'none';
    if (hasMembers) {
        collapsibleType = 'childrenProperties';
    } else if (Boolean(additionalDetails) && !nestedPath) {
        collapsibleType = 'code';
    }

    return collapsibleType;
}

function getDetailsId(id: string) {
    return `${id}-details`;
}

function useMemberAdditionalDetails(member: MemberNode) {
    const memberType = getMemberType(member);
    if (memberType === 'function') {
        return member;
    }
    const reference = useContext(ApiReferenceContext);
    if (reference?.has(memberType) && !isInterfaceHidden(memberType)) {
        const ref = reference.get(memberType);

        if (ref?.kind === 'typeAlias' && typeof ref.type === 'string' && reference.has(ref.type)) {
            return [ref, reference.get(ref.type)];
        }

        return ref;
    }
    if (typeof member.type === 'object' && member.type.kind === 'union') {
        const unionTypes = member.type.type
            .map((unionType) => typeof unionType === 'string' && reference?.get(unionType))
            .filter(
                (apiNode): apiNode is TypeAliasNode =>
                    typeof apiNode === 'object' && apiNode.kind === 'typeAlias' && !isInterfaceHidden(apiNode.name)
            );
        if (unionTypes.length) {
            return unionTypes;
        }
    }
}

function scrollToAndHighlightById(id: string) {
    scrollIntoViewById(id);
    const element = document.getElementById(id);
    element?.classList.add(styles.highlightAnimate);
    element?.addEventListener('animationend', () => {
        element.classList.remove(styles.highlightAnimate);
    });
}
