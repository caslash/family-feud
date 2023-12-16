//
//  MatchManager+GKMatchDelegate.swift
//  FeudKit
//
//  Created by Cameron Slash on 12/16/23.
//

import Foundation
import GameKit

extension MatchManager: GKMatchDelegate {
    public func match(_ match: GKMatch, player: GKPlayer, didChange state: GKPlayerConnectionState) {
        guard state == .disconnected && !isGameOver else { return }
        
        #if os(iOS)
        let alert = UIAlertController(title: "Player disconnected", message: "Someone disconnected from the game.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            self.match?.disconnect()
        })
        #else
        let alert = NSAlert()
        alert.messageText = "Player disconnected."
        alert.informativeText = "Someone disconnected from the game."
        alert.alertStyle = .warning
        #endif
        
        DispatchQueue.main.async {
            self.resetGame()
            #if os(iOS)
            self.rootViewController?.present(alert, animated: true)
            #else
            let alertResult = alert.runModal()
            
            switch alertResult {
            default: self.match?.disconnect()
            }
            #endif
        }
    }
}
