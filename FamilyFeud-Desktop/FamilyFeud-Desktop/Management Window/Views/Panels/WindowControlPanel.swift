//
//  WindowControlPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/1/23.
//

import SwiftUI

struct WindowControlPanel: View {
    var body: some View {
        PanelView("Window Control") {
            VStack(spacing: 18) {
                Button("Show Game Window") { }
                
                Button("Toggle Fullscreen") { }
            }
        }
        .frame(width: 200, height: 200, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
    }
}

#Preview {
    WindowControlPanel()
}
