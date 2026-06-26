export const Skeleton = ({ className = "", ...props }) => {
  return (
    <div
      className={`animate-pulse bg-[#242D3D]/60 rounded-md ${className}`}
      {...props}
    />
  );
};
