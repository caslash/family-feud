//
//  MatchManager+GKMatchmakerViewControllerDelegate.swift
//  FeudKit
//
//  Created by Cameron Slash on 12/16/23.
//

import Foundation
import GameKit

extension MatchManager: GKMatchmakerViewControllerDelegate {
    public func matchmakerViewController(_ viewController: GKMatchmakerViewController, didFind match: GKMatch) {
        #if os(iOS)
        viewController.dismiss(animated: true)
        #else
        self.rootViewController?.dismiss(viewController)
        #endif
        self.startGame(newMatch: match)
    }
    public func matchmakerViewController(_ viewController: GKMatchmakerViewController, didFailWithError error: Error) {
        #if os(iOS)
        viewController.dismiss(animated: true)
        #else
        self.rootViewController?.dismiss(viewController)
        #endif
    }
    public func matchmakerViewControllerWasCancelled(_ viewController: GKMatchmakerViewController) {
        #if os(iOS)
        viewController.dismiss(animated: true)
        #else
        self.rootViewController?.dismiss(viewController)
        #endif
    }
}
