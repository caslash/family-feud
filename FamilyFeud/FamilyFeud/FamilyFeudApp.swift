//
//  FamilyFeudApp.swift
//  FamilyFeud
//
//  Created by Cameron Slash on 11/30/23.
//

import FeudKit
import SwiftUI

@main
struct FamilyFeudApp: App {
    @State private var game = FamilyFeudGame()
    @State private var viewstateservice = ViewStateService()
    @State private var multiplayerservice = MultiplayerService()
    var body: some Scene {
        WindowGroup(id: "Management") {
            ManagementWindow()
                .environment(game)
                .environment(viewstateservice)
                .environment(multiplayerservice)
        }
        .windowResizability(.contentSize)
        
        WindowGroup(id: "Game") {
            GameWindow()
                .environment(game)
        }
    }
}
