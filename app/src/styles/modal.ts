import { StyleSheet } from "react-native";

export const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(3,10,8,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#f5efe4",
    borderRadius: 24,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: "#c9a45c",
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    color: "#10251d",
  },
  modalText: {
    textAlign: "center",
    color: "#5f5242",
    fontWeight: "700",
  },
  modalSuitGrid: {
    gap: 10,
  },
  modalSuitButton: {
    backgroundColor: "#fbf8f1",
    borderWidth: 1,
    borderColor: "#ded1bb",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalSuitIcon: {
    width: 42,
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  modalSuitText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#10251d",
  },
  modalYesButton: {
    backgroundColor: "#1f7a54",
    borderRadius: 15,
    paddingVertical: 13,
    alignItems: "center",
  },
  modalYesButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  cancelButton: {
    backgroundColor: "#e7ded0",
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#17352a",
    fontWeight: "900",
  },
  voteText: {
    textAlign: "center",
    color: "#6b7280",
    fontWeight: "800",
    fontSize: 12,
  },
});
